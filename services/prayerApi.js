// Prayer time SOURCE SYSTEM — official sources first, calculation second.
//
// Architecture:
//   selectedCity
//       |
//       v
//   resolvePrayerSource(selectedCity)  (services/officialSources.js)
//       |   most specific wins: official_city > official_region >
//       |   official_country
//       +-- match -> fetch the official schedule (with source metadata)
//       |
//       +-- no match / official fetch failed -> AlAdhan calculation API,
//           method chosen per country (incl. the official ДУМ России
//           method id 14 for RF, Umm al-Qura id 4 for Saudi Arabia)
//
// MANUAL vs AUTO: when the user picked a calculation method manually
// (methodOverridden), the calculation API runs with that method and the
// official-source chain is skipped — a manual choice is never silently
// replaced by the resolver. AUTO (the default) tries the resolver first.
//
// Every returned schedule carries a `source` descriptor so the UI can
// honestly label where the times come from. Times are ALWAYS in the
// selected city's timezone.

const BASE_URL = "https://api.aladhan.com/v1";

import {
  OFFICIAL_PRAYER_SOURCES,
  resolvePrayerSource,
  dagestanDayIndex,
} from "./officialSources";

// Calculation methods exposed in Settings. Ids are AlAdhan method ids.
// 14 = Spiritual Administration of Muslims of Russia (ДУМ России) —
// the official Russian muftiate method, used as the DEFAULT for Russia.
export const CALCULATION_METHODS = [
  { id: 14, name: "ДУМ России", country: "Россия" },
  { id: 3, name: "Muslim World League", country: null },
  { id: 2, name: "ISNA (Северная Америка)", country: null },
  { id: 5, name: "Египетское управление обсерваторий", country: null },
  { id: 4, name: "Умм-аль-Кура, Мекка", country: null },
  { id: 1, name: "Университет исламских наук, Карачи", country: null },
  { id: 8, name: "Регион Персидского залива", country: null },
  { id: 9, name: "Кувейт", country: null },
  { id: 10, name: "Катар", country: null },
  { id: 13, name: "Diyanet İşleri Başkanlığı, Турция", country: null },
  { id: 7, name: "Тегеран", country: null },
];

export const DEFAULT_METHOD = 3; // Muslim World League
export const RUSSIA_METHOD = 14; // ДУМ России

// Registry of CONFIRMED official sources lives in
// services/officialSources.js (OFFICIAL_PRAYER_SOURCES) together with
// resolvePrayerSource(). This alias is kept so existing imports and
// docs stay valid; entries are source+applicability rules, NOT a
// manual world-city list.
//
// VERIFICATION STATUS (updated 2026-09-13):
// - Muftiyat of Dagestan (muftiyatrd.ru): CONFIRMED machine-readable
//   JSON per district (https://muftiyatrd.ru/json/namaz/{slug}.json,
//   27 slugs, 365 days, namaz_1..5 + voshod). Registered as
//   official_region for Russia/Dagestan. Takes priority over the
//   ДУМ России method inside Dagestan ONLY.
// - DUM of the Republic of Tatarstan (dumrt.ru): CONFIRMED machine-
//   readable CSV per district (https://dumrt.ru/netcat_files/482/640/
//   {Slug}.csv, 44 slugs, 730 rows = 2025+2026, semicolon-separated).
//   Registered as official_region for Russia/Tatarstan. Takes priority
//   over the ДУМ России method inside Tatarstan ONLY.
// - Umm al-Qura (Saudi Arabia): NO public machine-readable API found;
//   time.uqu.edu.sa unresolvable from the app network -> NOT registered;
//   Saudi cities use the AlAdhan Umm al-Qura method (id 4).
// - ДУМ России: an official calculation METHOD (AlAdhan id 14), not a
//   per-city schedule API -> remains the country-level calculation
//   fallback for Russian cities without a more specific source.
// - Chechnya (dumchr.ru): times are a client-side PrayTimes.org
//   calculator widget (not a published schedule) and the site's TLS
//   certificate is expired (2026-03-21) -> NOT registered.
// - namaz.today: HTML schedules, no per-city JSON API -> NOT registered.
export const OFFICIAL_SOURCE_REGISTRY = OFFICIAL_PRAYER_SOURCES;

// Country -> default method when the user has not chosen one.
const COUNTRY_DEFAULT_METHOD = [
  { method: RUSSIA_METHOD, match: /russia|россия|российская/i },
  { method: 13, match: /türkiye|turkey|турция/i },
  { method: 4, match: /saudi|саудовск/i },
  { method: 9, match: /kuwait|кувейт/i },
  { method: 10, match: /qatar|катар/i },
  { method: 8, match: /united arab emirates|оаэ|emirates/i },
  { method: 5, match: /egypt|египет/i },
];

export function defaultMethodForCountry(country) {
  if (country) {
    for (const entry of COUNTRY_DEFAULT_METHOD) {
      if (entry.match.test(country)) return entry.method;
    }
  }
  return DEFAULT_METHOD;
}

export function methodName(id) {
  const found = CALCULATION_METHODS.find((m) => m.id === Number(id));
  return found ? found.name : "Muslim World League";
}

// Six rows for the main screen: 5 prayers + Sunrise (not a prayer).
const PRAYER_KEYS = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

async function fetchWithTimeout(url, ms = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function cleanTime(t) {
  if (!t) return null;
  return String(t).split(" ")[0];
}

// AlAdhan returns the Hijri date of the city's calendar day. Re-render
// it in Russian (day -> month -> year) using our month names; falls
// back to the local Kuwaiti algorithm when the API omits it.
function hijriDateRuFromAlAdhan(hijri, timezone) {
  if (hijri && hijri.day && hijri.month && hijri.month.number) {
    const { formatHijriDate } = require("../utils/hijri");
    const formatted = formatHijriDate({
      day: Number(hijri.day),
      month: Number(hijri.month.number),
      year: Number(hijri.year),
    });
    if (formatted) return { text: formatted, algorithmic: false };
  }
  try {
    const { formatHijriDate: fmt, gregorianToHijri } = require("../utils/hijri");
    const { todayInTimeZone } = require("../utils/time");
    const [y, m, d] = todayInTimeZone(timezone || undefined).split("-").map(Number);
    const formatted = fmt(gregorianToHijri(y, m, d));
    if (formatted) return { text: formatted, algorithmic: true };
  } catch (e) {
    // fall through
  }
  return null;
}

// Main entry: resolve a schedule for the selected city through the
// source-priority chain. Throws typed errors:
//   NETWORK_ERROR | API_ERROR | NO_DATA
//
// `method` semantics: null/undefined -> AUTO mode (official source
// chain first, then country-default calculation); a number -> MANUAL
// mode (that exact calculation method; the official chain is skipped
// so a manual choice is never silently replaced).
export async function fetchPrayerTimes({
  latitude,
  longitude,
  method,
  timezone,
  country,
  name,
  region,
}) {
  // 1) AUTO only: official source chain, most specific first, each
  //    failed entry falls through to the next one, then calculation.
  if (method == null) {
    const match = resolvePrayerSource({ name, region, country, latitude, longitude });
    if (match && Array.isArray(match.chain)) {
      for (const entry of match.chain) {
        try {
          const official = await fetchFromOfficial(entry, { latitude, longitude, timezone });
          if (official) return official;
        } catch (e) {
          // this official source failed -> continue to the next one
        }
      }
    } else if (match) {
      try {
        const official = await fetchFromOfficial(match, { latitude, longitude, timezone });
        if (official) return official;
      } catch (e) {
        // official source failed -> fall through to calculation
      }
    }
  }

  // 2) Calculation API: manual method or country default.
  const effectiveMethod =
    method != null ? method : defaultMethodForCountry(country);
  try {
    return await fetchFromAlAdhan({
      latitude,
      longitude,
      method: effectiveMethod,
      timezone,
      country,
    });
  } catch (e) {
    if (e && (e.message === "NETWORK_ERROR" || e.message === "API_ERROR")) throw e;
    throw new Error("NO_DATA");
  }
}

// Fetch a schedule from an official source entry. Dispatches by
// fetchType; each fetch validates the payload strictly and throws
// API_ERROR on any mismatch (no fabricated times, no silent labeling).
async function fetchFromOfficial(entry, { latitude, longitude, timezone }) {
  const { source, resolved } = entry;
  if (source.fetchType === "muftiyat_rd_json") {
    if (!resolved || !resolved.slug) return null;
    const dayIndex = dagestanDayIndex(timezone);
    if (dayIndex == null) return null;
    const url = `${source.endpoint}${resolved.slug}.json`;
    const response = await fetchWithTimeout(url, 4000);
    if (!response.ok) throw new Error("API_ERROR");
    const year = await response.json();
    if (!Array.isArray(year) || year.length !== 365) throw new Error("API_ERROR");
    const day = year[dayIndex];
    if (!day) throw new Error("API_ERROR");

    const timeOf = (v) => (/^\d{1,2}:\d{2}$/.test(String(v || "")) ? String(v) : null);
    const prayers = [
      { name: "Fajr", key: "namaz_1" },
      { name: "Sunrise", key: "voshod" },
      { name: "Dhuhr", key: "namaz_2" },
      { name: "Asr", key: "namaz_3" },
      { name: "Maghrib", key: "namaz_4" },
      { name: "Isha", key: "namaz_5" },
    ]
      .map(({ name, key }) => ({ name, time: timeOf(day[key]) }))
      .filter((p) => p.time !== null);
    if (prayers.length !== 6) throw new Error("API_ERROR"); // no fabricated times

    return {
      prayers,
      hijriDate: null,
      hijriDateRu: hijriLocal(timezone),
      gregorianDate: null,
      timezone: timezone || null,
      source: {
        type: source.sourceType,
        name: source.sourceName,
        url: source.sourceUrl,
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  // DUM of the Republic of Tatarstan: per-district CSV on dumrt.ru.
  // Format verified 2026-09-13: semicolon-separated; each data row is
  //   date;Таң;Fajr;Sunrise;Зәвәл;Dhuhr;Asr;Maghrib;Isha[;Qibla]
  // (2025 rows carry a trailing Qibla column; 2026 rows do not — the
  // date column decides which year a row belongs to). Dhuhr is the
  // official fixed mosque time (12:00); Зәвәл (solar noon) is published
  // for reference and is NOT used as the Dhuhr row.
  if (source.fetchType === "dumrt_csv") {
    if (!resolved || !resolved.slug) return null;
    const { todayInTimeZone } = require("../utils/time");
    const today = todayInTimeZone(timezone || undefined); // yyyy-mm-dd
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
    const [y, m, d] = today.split("-").map(Number);
    const wanted = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;

    const url = `${source.endpoint}${resolved.slug}.csv`;
    const response = await fetchWithTimeout(url, 4000);
    if (!response.ok) throw new Error("API_ERROR");
    const text = await response.text();
    if (!text || text.length < 200) throw new Error("API_ERROR");

    const dateRe = /^\d{2}\.\d{2}\.\d{4}$/;
    let row = null;
    let dataRows = 0;
    for (const rawLine of text.split(/\r?\n/)) {
      const parts = rawLine.split(";");
      if (parts.length < 9) continue;
      const dateCell = parts[0].trim();
      if (!dateRe.test(dateCell)) continue;
      dataRows++;
      if (dateCell === wanted) row = parts;
    }
    // The file must be a real year schedule (hundreds of rows), not a
    // stub/404-HTML rescue: two published years, ≥300 data rows.
    if (dataRows < 300 || !row) throw new Error("API_ERROR");

    const timeOf = (v) => (/^\d{1,2}:\d{2}$/.test(String(v || "").trim()) ? String(v).trim() : null);
    const prayers = [
      { name: "Fajr", key: 2 },
      { name: "Sunrise", key: 3 },
      { name: "Dhuhr", key: 5 },
      { name: "Asr", key: 6 },
      { name: "Maghrib", key: 7 },
      { name: "Isha", key: 8 },
    ]
      .map(({ name, key }) => ({ name, time: timeOf(row[key]) }))
      .filter((p) => p.time !== null);
    if (prayers.length !== 6) throw new Error("API_ERROR"); // no fabricated times

    return {
      prayers,
      hijriDate: null,
      hijriDateRu: hijriLocal(timezone),
      gregorianDate: null,
      timezone: timezone || null,
      source: {
        type: source.sourceType,
        name: source.sourceName,
        url: source.sourceUrl,
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  return null; // unknown fetchType -> caller continues down the chain
}

// Local Kuwaiti-algorithm Hijri date for the city calendar day (used
// when the official source does not supply one).
function hijriLocal(timezone) {
  try {
    const { formatHijriDate, gregorianToHijri } = require("../utils/hijri");
    const { todayInTimeZone } = require("../utils/time");
    const [y, m, d] = todayInTimeZone(timezone || undefined).split("-").map(Number);
    const formatted = formatHijriDate(gregorianToHijri(y, m, d));
    return formatted ? { text: formatted, algorithmic: true } : null;
  } catch (e) {
    return null;
  }
}

async function fetchFromAlAdhan({ latitude, longitude, method, timezone }) {
  // Date is computed in the CITY timezone so the schedule matches the
  // day the user is actually living through in that city.
  let day;
  try {
    const { todayInTimeZone } = require("../utils/time");
    day = todayInTimeZone(timezone)
      .split("-")
      .reverse()
      .join("-");
  } catch (e) {
    day = null;
  }
  if (!day) {
    const now = new Date();
    day = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
  }

  const url = `${BASE_URL}/timings/${day}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error("API_ERROR");
  const json = await response.json();
  if (!json || json.code !== 200 || !json.data || !json.data.timings) {
    throw new Error("API_ERROR");
  }

  const timings = json.data.timings;
  const prayers = [];
  for (const key of PRAYER_KEYS) {
    const time = cleanTime(timings[key]);
    if (!time) throw new Error("API_ERROR");
    prayers.push({ name: key, time });
  }

  return {
    prayers,
    hijriDate: json.data.date?.hijri
      ? `${json.data.date.hijri.day} ${json.data.date.hijri.month.en} ${json.data.date.hijri.year}`
      : null,
    hijriDateRu: hijriDateRuFromAlAdhan(json.data.date?.hijri, timezone),
    gregorianDate: json.data.date?.readable || null,
    timezone: json.data.meta?.timezone || timezone || null,
    source: {
      type: "calculated",
      name: `Расчётное расписание (${methodName(method)})`,
      url: "https://aladhan.com/prayer-times-api",
      lastUpdated: new Date().toISOString(),
    },
  };
}
