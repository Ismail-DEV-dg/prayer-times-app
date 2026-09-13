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

// ==================== territorial helpers: Tatarstan ====================
// The DUM of the Republic of Tatarstan (dumrt.ru) publishes one official
// CSV per district/city: /netcat_files/482/640/{Slug}.csv — semicolon-
// separated, 730 rows (two calendar years), columns (per the site's own
// rendering JS):
//   [0] date dd.mm.yyyy
//   [1] Таң / suhur end (dawn marker for fasting)
//   [2] Fajr  (Иртәнге намаз — mosque time)
//   [3] Sunrise (Кояш чыга)
//   [4] Зәвәл / solar noon (zawal)
//   [5] Dhuhr (Өйлә намазы — mosque time, fixed 12:00 on the site)
//   [6] Asr   (Икенде намазы)
//   [7] Maghrib (Ахшам намазы)
//   [8] Isha (Ястү намазы)
// These helpers form the APPLICABILITY RULE of that single source.

// Russian settlement/district name -> CSV slug (transliterated file name).
const TATARSTAN_SLUGS = {
  "азнакаево": "Aznakay",
  "аксубаево": "Aksubay",
  "актаныш": "Aktanis",
  "елабуга": "Elabuga",
  "алексеевское": "Aleksey",
  "апастово": "Apastovo",
  "арск": "Arsk",
  "базарные матаки": "BazarnyeMataki",
  "богатые сабы": "BogatyeSaby",
  "балтаси": "Baltasi",
  "балтач": "Baltasi",
  "рыбная слобода": "RibnayaSlpboda",
  "бавлы": "Bavli",
  "высокая гора": "VicokayGora",
  "болгар": "Bolgary",
  "буинск": "Buinsk",
  "бугульма": "Bugulma",
  "заинск": "Zainsk",
  "старое дрожжаное": "StaroeChuprale",
  "казань": "Kazan",
  "камское устье": "KamskoeUstye",
  "кукмор": "Kukmor",
  "лаишево": "Laish",
  "лениногорск": "Leninogorsk",
  "мамадыш": "Mamadis",
  "менделеевск": "Mendeleevsk",
  "мензелинск": "Menzilinsk",
  "муслюмово": "Muslimov",
  "нурлат": "Nurlat",
  "большие кайбицы": "BolshieKaybesy",
  "большая атня": "BolshAtna",
  "пестрецы": "Pestrezy",
  "сарманово": "Sarmanovo2",
  "тюлячи": "Tulyachi",
  "нижнекамск": "Nignekamsk",
  "тетюши": "Tet2",
  "уруссу": "Urussu",
  "черемшан": "Cheremsan",
  "чистополь": "Chistop",
  "верхний услон": "VerhUslon",
  "набережные челны": "NabChelny",
  "зеленодольск": "Zelenodolsk",
  "новошешминск": "Novosesminsk",
  "агрыз": "Agriz",
  "альметьевск": "Almet",
};

// District anchors (district centers of the republic) — the coverage
// geometry of the DUM RT per-district CSV files. A settlement without
// its own slug maps to the nearest anchor within 100 km (covers the
// whole republic; the region gate "Татарстан" keeps neighbors out).
const TATARSTAN_ANCHORS = [
  { slug: "Aznakay", name: "Азнакаево", lat: 54.85821, lon: 53.08006 },
  { slug: "Aksubay", name: "Аксубаево", lat: 54.84716, lon: 50.79631 },
  { slug: "Aktanis", name: "Актаныш", lat: 55.71714, lon: 54.07116 },
  { slug: "Elabuga", name: "Елабуга", lat: 55.76232, lon: 52.04425 },
  { slug: "Aleksey", name: "Алексеевское", lat: 55.30708, lon: 50.11888 },
  { slug: "Apastovo", name: "Апастово", lat: 55.20123, lon: 48.51127 },
  { slug: "Arsk", name: "Арск", lat: 56.09254, lon: 49.87819 },
  { slug: "BazarnyeMataki", name: "Базарные Матаки", lat: 54.90693, lon: 49.9342 },
  { slug: "BogatyeSaby", name: "Богатые Сабы", lat: 56.00942, lon: 50.44714 },
  { slug: "Baltasi", name: "Балтаси", lat: 56.34646, lon: 50.20749 },
  { slug: "RibnayaSlpboda", name: "Рыбная Слобода", lat: 55.46247, lon: 50.14443 },
  { slug: "Bavli", name: "Бавлы", lat: 54.39759, lon: 53.25116 },
  { slug: "VicokayGora", name: "Высокая Гора", lat: 55.90988, lon: 49.31343 },
  { slug: "Bolgary", name: "Болгар", lat: 54.97417, lon: 49.03083 },
  { slug: "Buinsk", name: "Буинск", lat: 54.97422, lon: 48.29088 },
  { slug: "Bugulma", name: "Бугульма", lat: 54.5378, lon: 52.7985 },
  { slug: "Zainsk", name: "Заинск", lat: 55.28359, lon: 51.99865 },
  { slug: "StaroeChuprale", name: "Старое Дрожжаное", lat: 54.72384, lon: 47.55652 },
  { slug: "Kazan", name: "Казань", lat: 55.78874, lon: 49.12214 },
  { slug: "KamskoeUstye", name: "Камское Устье", lat: 55.19557, lon: 49.26208 },
  { slug: "Kukmor", name: "Кукмор", lat: 56.18648, lon: 50.89404 },
  { slug: "Laish", name: "Лаишево", lat: 55.40559, lon: 49.5521 },
  { slug: "Leninogorsk", name: "Лениногорск", lat: 54.5971, lon: 52.45124 },
  { slug: "Mamadis", name: "Мамадыш", lat: 55.70273, lon: 51.40439 },
  { slug: "Mendeleevsk", name: "Менделеевск", lat: 55.89692, lon: 52.31119 },
  { slug: "Menzilinsk", name: "Мензелинск", lat: 55.72792, lon: 53.1022 },
  { slug: "Muslimov", name: "Муслюмово", lat: 55.30706, lon: 53.18855 },
  { slug: "Nurlat", name: "Нурлат", lat: 54.42903, lon: 50.80598 },
  { slug: "BolshieKaybesy", name: "Большие Кайбицы", lat: 55.40331, lon: 48.18552 },
  { slug: "BolshAtna", name: "Большая Атня", lat: 56.25059, lon: 49.45161 },
  { slug: "Pestrezy", name: "Пестрецы", lat: 55.75408, lon: 49.6511 },
  { slug: "Sarmanovo2", name: "Сарманово", lat: 55.25439, lon: 52.58784 },
  { slug: "Tulyachi", name: "Тюлячи", lat: 55.88889, lon: 50.23416 },
  { slug: "Nignekamsk", name: "Нижнекамск", lat: 55.63794, lon: 51.81502 },
  { slug: "Tet2", name: "Тетюши", lat: 54.93768, lon: 48.83267 },
  { slug: "Urussu", name: "Уруссу", lat: 54.59701, lon: 53.45625 },
  { slug: "Cheremsan", name: "Черемшан", lat: 54.66128, lon: 51.51143 },
  { slug: "Chistop", name: "Чистополь", lat: 55.36612, lon: 50.64399 },
  { slug: "VerhUslon", name: "Верхний Услон", lat: 55.768, lon: 48.9776 },
  { slug: "NabChelny", name: "Набережные Челны", lat: 55.73718, lon: 52.41961 },
  { slug: "Zelenodolsk", name: "Зеленодольск", lat: 55.84376, lon: 48.51784 },
  { slug: "Novosesminsk", name: "Новошешминск", lat: 55.06637, lon: 51.24061 },
  { slug: "Agriz", name: "Агрыз", lat: 56.5234, lon: 52.99431 },
  { slug: "Almet", name: "Альметьевск", lat: 54.90395, lon: 52.31793 },
];

function isTatarstanRegionName(canonRegion) {
  if (!canonRegion) return false;
  return /(^|\s)(татарстан|tatarstan)($|\s)/.test(canonRegion);
}

function resolveTatarstanSlug({ name, region }) {
  const cityName = canon(name);
  if (cityName && TATARSTAN_SLUGS[cityName]) return TATARSTAN_SLUGS[cityName];
  const regionName = canon(region);
  if (regionName && TATARSTAN_SLUGS[regionName]) return TATARSTAN_SLUGS[regionName];
  return null;
}

function nearestTatarstanAnchor(latitude, longitude, maxKm = 100) {
  let best = null;
  let bestKm = Infinity;
  for (const a of TATARSTAN_ANCHORS) {
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
  {
    // DUM of the Republic of Tatarstan — official regional muftiate.
    // Machine-readable: https://dumrt.ru/netcat_files/482/640/{Slug}.csv
    // VERIFIED 2026-09-13: all 44 slugs HTTP 200 (text/csv), 730 rows
    // each (full 2025 + 2026 years; today's row present), semicolon-
    // separated; columns per the site's own rendering JS (see the
    // Tatarstan helpers block above). Dhuhr is published as the fixed
    // mosque time 12:00 — that IS the official published schedule.
    id: "dum_rt",
    sourceName: "ДУМ Республики Татарстан",
    sourceLevel: "region",
    sourceType: "official_region",
    sourceUrl: "https://dumrt.ru/ru/help-info/prayertime/",
    fetchType: "dumrt_csv",
    priority: 100,
    endpoint: "https://dumrt.ru/netcat_files/482/640/",
    country: /(^|\s)(россия|russia)($|\s)/,
    region: /(^|\s)(татарстан|tatarstan)($|\s)/,
    matchesCountry: (c) => c.includes("россия") || c.includes("russia"),
    // "Татарстан" / "Республика Татарстан" / "Tatarstan" — geocoders and
    // the device reverse geocoder return these forms in admin1/region.
    matchRegion: isTatarstanRegionName,
    resolveCity: ({ name, region, latitude, longitude }) => {
      const slug =
        resolveTatarstanSlug({ name, region }) ||
        (latitude != null && longitude != null
          ? (nearestTatarstanAnchor(latitude, longitude) || {}).slug
          : null);
      return slug ? { slug } : null;
    },
    notes:
      "Territory: Republic of Tatarstan ONLY. Per-district CSV files; a " +
      "settlement maps to its district file (name/district match, then " +
      "nearest district anchor ≤100 km). NOT a source for the rest of Russia.",
  },
  // ------------------------------------------------------------------
  // Sources INTENTIONALLY NOT registered (checked 2026-09-12/13):
  // - Umm al-Qura (Saudi Arabia): no public machine-readable API;
  //   time.uqu.edu.sa DNS-unresolvable from the app network. Saudi
  //   cities -> calculation method 4 (Umm al-Qura via AlAdhan).
  // - DUM of Russia (dumrf.ru): official calculation METHOD (AlAdhan
  //   id 14) but NO schedule API -> stays the country-level calculation
  //   fallback, not a registry entry.
  // - Chechnya (dumchr.ru): official site reachable BUT (a) the times
  //   shown ("Времена Намазов в Грозном") are computed client-side by
  //   the PrayTimes.org calculator plugin (tm-islamic-helper), not a
  //   published schedule; (b) Grozny-only widget; (c) TLS certificate
  //   EXPIRED 2026-03-21 (secure fetch would fail on device).
  //   grozny-inform.ru/namaz -> HTTP 410. -> NOT registered; Chechnya
  //   cities use calculation method 14.
  // - Stavropol Krai (dumsk.com): official site behind a JS cookie wall
  //   (beget); times rendered by the salat-times WordPress calculator
  //   plugin; no per-city machine-readable schedule -> NOT registered.
  // - ЦДУМ России (cdum.ru): VERIFIED official year-table pages (2026
  //   data) for ~21 cities, but per-city HTML pages = a city list, and
  //   HTML scraping fragility; cities outside the list cannot honestly
  //   claim coverage -> NOT registered (documented in FINAL_REPORT).
  // - Diyanet (Türkiye, namazvakitleri.diyanet.gov.tr): per-district
  //   HTML pages; requires a hardcoded districtId->URL map of 1000+
  //   districts (a de-facto city list) -> NOT registered; Türkiye uses
  //   calculation method 13 (Diyanet via AlAdhan).
  // - MUIS Singapore / JAKIM Malaysia e-solat / UAE Awqaf: official
  //   sites exist but no confirmed machine-readable API reachable from
  //   this network (e-solat.gov.my DNS fails) -> NOT registered.
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
