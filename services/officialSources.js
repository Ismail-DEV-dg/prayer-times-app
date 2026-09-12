// OFFICIAL prayer-time sources registry + resolver (TERRITORY model).
//
// The registry answers: "Which CONFIRMED official prayer-time source
// covers this territory?" — NOT "which source for this city". Entries
// declare an area of applicability (country / region / city) plus a
// fetch rule. The resolver collects ALL applicable entries for the
// selected city and picks the most specific one:
//
//   OFFICIAL CITY  >  OFFICIAL REGION / MUFTIATE  >  OFFICIAL COUNTRY
//      >  CALCULATION API (caller)  >  CACHE (caller)
//
// Within one level, `priority` (higher = earlier) breaks ties.
// selectedCity { name, region, country, latitude, longitude, timezone }
// is the ONLY input — GPS/currentLocation never takes part here.
// Coordinates are never duplicated per city; a source may keep its own
// small territorial helpers (e.g. district anchors) as part of ITS
// applicability rule.
//
// HONESTY RULE: an entry is added ONLY after the source is verified as
// official for that territory AND machine-readable. Popular/official-
// looking sites without a verified API are NOT registered. Failed
// official fetch -> the caller continues down the chain (fallback), the
// UI never labels a fallback as the official source.

// Canonicalize a name for matching: lowercase, ё->е, strip punctuation.
function canon(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'`]/g, "")
    .replace(/[\s\-–—]+/g, " ")
    .trim();
}

const LEVEL_RANK = { city: 3, region: 2, country: 1 };

// ==================== territorial helpers: Dagestan ====================
// The Dagestan Muftiate publishes one JSON per settlement/district.
// These helpers form the APPLICABILITY RULE of that single source.

const DAGESTAN_SLUGS = {
  "махачкала": "mahashkala",
  "агул": "agul",
  "агульский район": "agul",
  "ахты": "ahti",
  "ахтынский район": "ahti",
  "ахвах": "ahvah",
  "ахвахский район": "ahvah",
  "бабаюрт": "babayurt",
  "бабаюртовский район": "babayurt",
  "ботлих": "botlih",
  "ботлихский район": "botlih",
  "буйнакск": "buynaksk",
  "буйнакский район": "buynaksk",
  "цумада": "cumada",
  "цумадинский район": "cumada",
  "даг-огни": "dagogni",
  "дагестанские огни": "dagogni",
  "дербент": "derbent",
  "дербентский район": "derbent",
  "гергебиль": "gergebil",
  "гергебильский район": "gergebil",
  "гумбет": "gumbet",
  "гумбетовский район": "gumbet",
  "хасавюрт": "hasavyurt",
  "хасавюртовский район": "hasavyurt",
  "хунзах": "hunzah",
  "хунзахский район": "hunzah",
  "избербаш": "izberbash",
  "касписк": "kaspiysk",
  "каспийск": "kaspiysk",
  "дылым": "kazbek",
  "казбековский район": "kazbek",
  "кизилюрт": "kizilurt",
  "кизилюртовский район": "kizilurt",
  "кизляр": "kizlyar",
  "кизлярский район": "kizlyar",
  "курах": "kurah",
  "курахский район": "kurah",
  "леваши": "levashi",
  "левашийский район": "levashi",
  "левашинский район": "levashi",
  "рутул": "rutul",
  "рутульский район": "rutul",
  "шамилькала": "shamilkala",
  "унцукульский район": "shamilkala",
  "чарода": "sharoda",
  "чародинский район": "sharoda",
  "южно-сухокумск": "suhokumsk",
  "тлярата": "tlarata",
  "тляратинский район": "tlarata",
  "унцукуль": "unsukul",
};

// District adjectives — the geocoder may return the district name where
// the settlement actually is ("Кизлярский район"), not "Дагестан".
const DAGESTAN_DISTRICT_HINTS = [
  "агульск", "ахтынск", "ахвахск", "бабаюртовск", "ботлихск", "буйнакск",
  "цумадинск", "дербентск", "гергебильск", "гумбетовск", "хасавюртовск",
  "хунзахск", "казбековск", "кизилюртовск", "кизлярск", "курахск",
  "левашинск", "левашийск", "рутульск", "унцукульск", "чародинск",
  "тляратинск",
];

function isDagestanRegionName(canonRegion) {
  if (!canonRegion) return false;
  if (/(^|\s)(дагестан|dagestan)($|\s)/.test(canonRegion)) return true;
  return DAGESTAN_DISTRICT_HINTS.some((hint) => canonRegion.includes(hint));
}

// District anchors (district centers) — the coverage geometry of the
// Muftiate's per-district files. A village without its own slug maps to
// the nearest district anchor within 55 km (district files differ by
// only ~1-2 minutes across the republic).
const DAGESTAN_ANCHORS = [
  { slug: "mahashkala", name: "Махачкала", lat: 42.97782, lon: 47.50027 },
  { slug: "agul", name: "Тпиг", lat: 41.78008, lon: 47.59241 },
  { slug: "ahti", name: "Ахты", lat: 41.45949, lon: 47.73247 },
  { slug: "ahvah", name: "Карата", lat: 42.59567, lon: 46.33953 },
  { slug: "babayurt", name: "Бабаюрт", lat: 43.59976, lon: 46.77805 },
  { slug: "botlih", name: "Ботлих", lat: 42.66531, lon: 46.22030 },
  { slug: "buynaksk", name: "Буйнакск", lat: 42.81802, lon: 47.12684 },
  { slug: "cumada", name: "Агвали", lat: 42.53938, lon: 46.12217 },
  { slug: "dagogni", name: "Даг-Огни", lat: 42.11585, lon: 48.19192 },
  { slug: "derbent", name: "Дербент", lat: 42.06622, lon: 48.28759 },
  { slug: "gergebil", name: "Гергебиль", lat: 42.50472, lon: 47.06611 },
  { slug: "gumbet", name: "Мехельта", lat: 42.79059, lon: 46.50307 },
  { slug: "hasavyurt", name: "Хасавюрт", lat: 43.24872, lon: 46.58571 },
  { slug: "hunzah", name: "Хунзах", lat: 42.54286, lon: 46.70605 },
  { slug: "izberbash", name: "Избербаш", lat: 42.56705, lon: 47.87546 },
  { slug: "kaspiysk", name: "Каспийск", lat: 42.88165, lon: 47.63919 },
  { slug: "kazbek", name: "Дылым", lat: 43.07099, lon: 46.63454 },
  { slug: "kizilurt", name: "Кизилюрт", lat: 43.20279, lon: 46.86594 },
  { slug: "kizlyar", name: "Кизляр", lat: 43.84686, lon: 46.70977 },
  { slug: "kurah", name: "Курах", lat: 41.58488, lon: 47.78207 },
  { slug: "levashi", name: "Леваши", lat: 42.43224, lon: 47.32370 },
  { slug: "rutul", name: "Рутул", lat: 41.53439, lon: 47.42399 },
  { slug: "shamilkala", name: "Шамилькала", lat: 42.68710, lon: 46.86845 },
  { slug: "sharoda", name: "Чарода", lat: 42.27608, lon: 46.80432 },
  { slug: "suhokumsk", name: "Южно-Сухокумск", lat: 44.66033, lon: 45.64750 },
  { slug: "tlarata", name: "Тлярата", lat: 42.10552, lon: 46.35416 },
  { slug: "unsukul", name: "Унцукуль", lat: 42.71149, lon: 46.78663 },
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function resolveDagestanSlug({ name, region }) {
  const cityName = canon(name);
  if (cityName && DAGESTAN_SLUGS[cityName]) return DAGESTAN_SLUGS[cityName];
  const regionName = canon(region);
  if (regionName && DAGESTAN_SLUGS[regionName]) return DAGESTAN_SLUGS[regionName];
  return null;
}

function nearestDagestanAnchor(latitude, longitude, maxKm = 55) {
  let best = null;
  let bestKm = Infinity;
  for (const a of DAGESTAN_ANCHORS) {
    const km = haversineKm(latitude, longitude, a.lat, a.lon);
    if (km < bestKm) {
      bestKm = km;
      best = a;
    }
  }
  return bestKm <= maxKm ? best : null;
}

// ============================ REGISTRY ============================
// Entry model (recommended fields; not all are mandatory):
//   id           unique string
//   sourceName   honest human name shown in the UI
//   sourceLevel  "city" | "region" | "country"   (specificity)
//   sourceType   "official_city"|"official_region"|"official_country"
//   sourceUrl    public page of the authority
//   fetchType    how to fetch a schedule ("muftiyat_rd_json" today)
//   priority     number; higher wins among entries of the SAME level
//   country      string | RegExp | predicate (canonical name)
//   region       string | RegExp | predicate (optional for country level)
//   city         string | predicate (only for city-level sources)
//   resolveCity  ({ name, region, latitude, longitude }) -> params for
//                the fetch (e.g. { slug }) or null = not covered
//
// VERIFICATION STATUS must be documented per entry and kept in sync
// with FINAL_REPORT.md.

export const OFFICIAL_PRAYER_SOURCES = [
  {
    // Muftiyat of the Republic of Dagestan — official regional muftiate.
    // Machine-readable: https://muftiyatrd.ru/json/namaz/{slug}.json
    // VERIFIED 2026-09-12: 27 slugs HTTP 200, 365 entries each,
    // namaz_1..5 (Fajr..Isha) + voshod (Sunrise), index = dayOfYear-1.
    id: "muftiyat_rd",
    sourceName: "Муфтият Республики Дагестан",
    sourceLevel: "region",
    sourceType: "official_region",
    sourceUrl: "https://muftiyatrd.ru/",
    fetchType: "muftiyat_rd_json",
    priority: 100,
    endpoint: "https://muftiyatrd.ru/json/namaz/",
    country: /(^|\s)(россия|russia)($|\s)/,
    region: /(^|\s)(дагестан|dagestan)($|\s)/,
    matchesCountry: (c) => c.includes("россия") || c.includes("russia"),
    // "Дагестан" OR a district name of the covered republic districts
    // ("Кизлярский район" etc.) — geocoders return either form.
    matchRegion: isDagestanRegionName,
    resolveCity: ({ name, region, latitude, longitude }) => {
      const slug =
        resolveDagestanSlug({ name, region }) ||
        (latitude != null && longitude != null
          ? (nearestDagestanAnchor(latitude, longitude) || {}).slug
          : null);
      return slug ? { slug } : null;
    },
    notes:
      "Territory: Republic of Dagestan ONLY. Per-district JSON files; a " +
      "settlement maps to its district file (name/district match, then " +
      "nearest district anchor ≤55 km). NOT a source for the rest of Russia.",
  },
  // ------------------------------------------------------------------
  // Sources INTENTIONALLY NOT registered (checked 2026-09-12/13):
  // - Umm al-Qura (Saudi Arabia): no public machine-readable API;
  //   time.uqu.edu.sa DNS-unresolvable from the app network. Saudi
  //   cities -> calculation method 4 (Umm al-Qura via AlAdhan).
  // - DUM of Russia (dumrf.ru): official calculation METHOD (AlAdhan
  //   id 14) but NO schedule API -> stays the country-level calculation
  //   fallback, not a registry entry.
  // - Chechnya (grozny-inform.ru/namaz): HTTP 410 Gone; no machine-
  //   readable API found -> NOT registered. Grozny uses calculation.
  // - Stavropol Krai: no confirmed official machine-readable source
  //   found -> NOT registered.
  // - namaz.today: HTML pages, no per-city JSON API -> NOT registered.
];

// Compatibility alias (old name kept; same array).
export const OFFICIAL_SOURCE_REGISTRY = OFFICIAL_PRAYER_SOURCES;

// ============================ RESOLVER ============================
// Collect ALL registry entries applicable to the city, then pick the
// most specific one (city > region > country; priority breaks ties).
// Works for any world territory: applicability is declared per entry.
export function resolvePrayerSource(city) {
  if (!city) return null;
  const canonCountry = canon(city.country);
  const canonRegion = canon(city.region);
  const canonName = canon(city.name);

  const applicable = [];
  for (const source of OFFICIAL_PRAYER_SOURCES) {
    // country applicability
    const countryOk =
      typeof source.country === "function"
        ? source.country(canonCountry)
        : source.country instanceof RegExp
        ? source.country.test(canonCountry)
        : source.country != null
        ? canon(source.country) === canonCountry
        : true;
    if (!countryOk) continue;

    // region applicability (mandatory for region-level, optional for country)
    if (source.sourceLevel === "region" || source.region != null) {
      const regionOk =
        typeof source.matchRegion === "function"
          ? source.matchRegion(canonRegion)
          : typeof source.region === "function"
          ? source.region(canonRegion)
          : source.region instanceof RegExp
          ? source.region.test(canonRegion)
          : source.region != null
          ? canon(source.region) === canonRegion
          : true;
      if (!regionOk) continue;
    }

    // city applicability (only for city-level sources)
    let resolved = null;
    if (source.sourceLevel === "city") {
      const cityOk =
        typeof source.city === "function"
          ? source.city(canonName, { region: canonRegion, country: canonCountry })
          : source.city != null
          ? canon(source.city) === canonName
          : Boolean(source.resolveCity);
      if (!cityOk) continue;
    }
    if (source.resolveCity) {
      resolved = source.resolveCity(city);
      if (!resolved) continue; // source covers the territory but not this settlement
    }

    applicable.push({
      source,
      resolved,
      specificity: source.sourceLevel,
      rank: LEVEL_RANK[source.sourceLevel] || 0,
    });
  }

  if (applicable.length === 0) return null;
  applicable.sort(
    (a, b) => b.rank - a.rank || (b.source.priority || 0) - (a.source.priority || 0)
  );
  const best = applicable[0];
  return {
    source: best.source,
    resolved: best.resolved,
    specificity: best.specificity,
    // The full ordered chain lets the caller fall back level by level.
    chain: applicable.map((m) => ({ source: m.source, resolved: m.resolved, specificity: m.specificity })),
  };
}

// Day index inside the Muftiate year file: dayOfYear - 1, computed in
// the CITY timezone so the schedule matches the day the user lives
// through (the same rule the Muftiate site widget uses).
export function dagestanDayIndex(timezone) {
  const now = new Date();
  let yearStart;
  let dayOfYear;
  try {
    const { nowInTimeZone } = require("../utils/time");
    const p = nowInTimeZone(timezone || undefined);
    yearStart = Date.UTC(p.year, 0, 0);
    dayOfYear = Math.floor(
      (Date.UTC(p.year, p.month - 1, p.day) - yearStart) / 86400000
    );
  } catch (e) {
    const start = new Date(now.getFullYear(), 0, 0);
    dayOfYear = Math.floor((now - start) / 86400000);
  }
  const idx = dayOfYear - 1;
  return idx >= 0 && idx <= 364 ? idx : null;
}
