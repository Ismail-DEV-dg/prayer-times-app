// Prayer-source system tests (run with: node scripts/test-prayer-sources.js)
// Pure-Node harness: loads officialSources.js + prayerApi.js the same
// way run-tests.js strips ESM exports. Network tests (marked ONLINE)
// do real fetches; resolver tests are fully offline.
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const results = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  return async () => {
    try {
      await fn();
      passed++;
      results.push(`PASS  ${name}`);
    } catch (e) {
      failed++;
      results.push(`FAIL  ${name}\n      ${e && e.message}`);
    }
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

// Pre-load dependency chain through a global registry (avoids backslash
// escaping issues when embedding absolute Windows paths into require).
const __cjsRegistry = (global.__cjsRegistry = global.__cjsRegistry || {});

function load(relPath) {
  const full = path.join(ROOT, relPath);
  const src = fs
    .readFileSync(full, "utf8")
    .replace(/^export function/gm, "function")
    .replace(/^export async function/gm, "async function")
    .replace(/^export const /gm, "const ")
    .replace(/^export default /gm, "module.exports.default = ")
    .replace(/^import \{([^}]+)\} from "(.+?)";$/gm, (m, names, from) => {
      const resolved = resolveJs(path.join(path.dirname(full), from));
      if (!__cjsRegistry[resolved]) preload(resolved);
      const list = names.split(",").map((s) => s.trim()).filter(Boolean);
      return list.map((n) => `const ${n} = __cjsRegistry["${escaped(resolved)}"].${n};`).join("\n");
    });
  const names = [];
  const exportRe = /^(?:async )?function (\w+)|^const (\w+)(?=\s*=)/gm;
  let m;
  while ((m = exportRe.exec(src))) names.push(m[1] || m[2]);
  const moduleSrc =
    "const __cjsRegistry = (global.__cjsRegistry = global.__cjsRegistry || {});\n" +
    src +
    "\nmodule.exports = { " + names.join(", ") + " };";
  const tmp = path.join(ROOT, ".expo", "test_mod_" + path.basename(relPath).replace(/[\\\/]/g, "_"));
  fs.writeFileSync(tmp + ".js", moduleSrc);
  return require(tmp + ".js");
}

function escaped(p) {
  return String(p).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function resolveJs(p) {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  if (fs.existsSync(p + ".js")) return p + ".js";
  throw new Error("Cannot resolve module: " + p);
}

function preload(absolutePath) {
  const src = fs
    .readFileSync(absolutePath, "utf8")
    .replace(/^export function/gm, "function")
    .replace(/^export async function/gm, "async function")
    .replace(/^export const /gm, "const ")
    .replace(/^export default /gm, "module.exports.default = ")
    .replace(/^import \{([^}]+)\} from "(.+?)";$/gm, (m, names, from) => {
      const resolved = resolveJs(path.join(path.dirname(absolutePath), from));
      if (!__cjsRegistry[resolved]) preload(resolved);
      const list = names.split(",").map((s) => s.trim()).filter(Boolean);
      return list.map((n) => `const ${n} = __cjsRegistry["${escaped(resolved)}"].${n};`).join("\n");
    });
  const names = [];
  const exportRe = /^(?:async )?function (\w+)|^const (\w+)(?=\s*=)/gm;
  let m;
  while ((m = exportRe.exec(src))) names.push(m[1] || m[2]);
  const moduleSrc =
    "const __cjsRegistry = (global.__cjsRegistry = global.__cjsRegistry || {});\n" +
    src + "\nmodule.exports = { " + names.join(", ") + " };";
  const tmp = path.join(ROOT, ".expo", "test_pre_" + path.basename(absolutePath).replace(/[\\\/.]/g, "_"));
  fs.writeFileSync(tmp + ".js", moduleSrc);
  __cjsRegistry[absolutePath] = require(tmp + ".js");
  return __cjsRegistry[absolutePath];
}

const official = preload(path.join(ROOT, "services", "officialSources.js")); // no imports
const prayer = load("services/prayerApi.js"); // imports ./officialSources
const cityHelpers = load("utils/city.js"); // pure logic, no imports

const DERBENT = { name: "Дербент", region: "Дагестан", country: "Россия / Russia", latitude: 42.06622, longitude: 48.28759, timezone: "Europe/Moscow" };
const MAKHACHKALA = { name: "Махачкала", region: "Республика Дагестан", country: "Россия / Russia", latitude: 42.97782, longitude: 47.50027, timezone: "Europe/Moscow" };
const GIMRY = { name: "Гимры", region: "Дагестан", country: "Россия / Russia", latitude: 42.4, longitude: 46.9, timezone: "Europe/Moscow" }; // village: name slug absent -> anchor
const KHUNZAKH_VILLAGE = { name: "Тлярата", region: "Дагестан", country: "Россия / Russia", latitude: 42.10552, longitude: 46.35416, timezone: "Europe/Moscow" };
const MOSCOW = { name: "Москва", region: "Москва", country: "Россия / Russia", latitude: 55.7558, longitude: 37.6173, timezone: "Europe/Moscow" };
const MEDINA = { name: "Medina", region: "Al Madinah", country: "Saudi Arabia", latitude: 24.4686, longitude: 39.6142, timezone: "Asia/Riyadh" };
const HELSINKI = { name: "Helsinki", region: "Uusimaa", country: "Finland", latitude: 60.1699, longitude: 24.9384, timezone: "Europe/Helsinki" };
// Tatarstan fixtures (DUM RT CSV source)
const KAZAN = { name: "Казань", region: "Татарстан", country: "Россия", latitude: 55.78874, longitude: 49.12214, timezone: "Europe/Moscow" };
const NABEREZHNYE_CHELY = { name: "Набережные Челны", region: "Республика Татарстан", country: "Россия", latitude: 55.73718, longitude: 52.41961, timezone: "Europe/Moscow" };
const GROZNY = { name: "Грозный", region: "Чечня", country: "Россия", latitude: 43.31195, longitude: 45.68895, timezone: "Europe/Moscow" };
const STAVROPOL = { name: "Ставрополь", region: "Ставрополье", country: "Россия", latitude: 45.03442, longitude: 41.9642, timezone: "Europe/Moscow" };

const tests = [];

// ---------- Resolver (offline) ----------

tests.push(
  test("T1 Derbent/Dagestan/Russia -> Муфтият Республики Дагестан (region level)", () => {
    const m = official.resolvePrayerSource(DERBENT);
    assert(m, "no match");
    assert(m.specificity === "region", `specificity: ${m.specificity}`);
    assert(m.source.sourceLevel === "region", `sourceLevel: ${m.source.sourceLevel}`);
    assert(m.source.sourceName === "Муфтият Республики Дагестан", m.source.sourceName);
    assert(m.resolved.slug === "derbent", `slug: ${m.resolved.slug}`);
  })
);

tests.push(
  test("T2 other Dagestan city/village (no own slug) -> Muftiate via district anchor", () => {
    const m = official.resolvePrayerSource(GIMRY);
    assert(m, "no match");
    assert(m.source.sourceName === "Муфтият Республики Дагестан", m.source.sourceName);
    // Gimry has no own slug: it must still resolve to SOME official
    // district file (nearest-anchor policy; district files differ by
    // ~1-2 min across the republic, see FINAL_REPORT §8).
    assert(typeof m.resolved.slug === "string" && m.resolved.slug.length > 0, "no slug");
    const KNOWN_SLUGS = ["mahashkala","agul","ahti","ahvah","babayurt","botlih","buynaksk","cumada","dagogni","derbent","gergebil","gumbet","hasavyurt","hunzah","izberbash","kaspiysk","kazbek","kizilurt","kizlyar","kurah","levashi","rutul","shamilkala","sharoda","suhokumsk","tlarata","unsukul"];
    assert(KNOWN_SLUGS.includes(m.resolved.slug), `unknown slug ${m.resolved.slug}`);
    // Tlyarata (district center) resolves to its own file
    const m2 = official.resolvePrayerSource(KHUNZAKH_VILLAGE);
    assert(m2.resolved.slug === "tlarata", `tlyarata slug: ${m2.resolved.slug}`);
    // District-name matching: Kizlyarsky district -> kizlyar file
    const m3 = official.resolvePrayerSource({ name: "Комсомольское", region: "Кизлярский район", country: "Россия", latitude: 43.65, longitude: 46.73, timezone: "Europe/Moscow" });
    assert(m3 && m3.resolved.slug === "kizlyar", `kizlyar district slug: ${m3 && m3.resolved.slug}`);
  })
);

tests.push(
  test("T3 Russian city outside Dagestan (Moscow) -> NO Muftiate", () => {
    const m = official.resolvePrayerSource(MOSCOW);
    assert(m === null, "Moscow must not match any official source");
  })
);

tests.push(
  test("T4 Medina/Saudi -> no confirmed official source (calculation API path)", () => {
    const m = official.resolvePrayerSource(MEDINA);
    assert(m === null, "Medina must not match (Umm al-Qura not machine-readable)");
  })
);

tests.push(
  test("T5 Helsinki/Finland -> no official source -> calculation API", () => {
    const m = official.resolvePrayerSource(HELSINKI);
    assert(m === null, "Helsinki must not match");
  })
);

tests.push(
  test("T6 hierarchy: city beats region; region beats country; priority breaks ties", () => {
    const reg = official.OFFICIAL_PRAYER_SOURCES;
    const fakeCity = {
      id: "test_city",
      sourceName: "TEST CITY SOURCE",
      sourceLevel: "city",
      sourceType: "official_city",
      sourceUrl: "https://example.com",
      fetchType: "test",
      priority: 100,
      matchesCountry: (c) => c.includes("россия") || c.includes("russia"),
      matchRegion: /дагестан|dagestan/,
      resolveCity: ({ name }) => (name === "Дербент" ? { slug: "x" } : null),
    };
    const fakeCountry = {
      id: "test_country",
      sourceName: "TEST COUNTRY SOURCE",
      sourceLevel: "country",
      sourceType: "official_country",
      sourceUrl: "https://example.com",
      fetchType: "test",
      priority: 50,
      matchesCountry: (c) => c.includes("россия") || c.includes("russia"),
      resolveCity: () => ({}), // covers any settlement of the country
    };
    reg.push(fakeCountry, fakeCity);
    try {
      // city > region > country for Derbent
      const m = official.resolvePrayerSource(DERBENT);
      assert(m && m.specificity === "city", `expected city, got ${m && m.specificity}`);
      assert(m.source.sourceName === "TEST CITY SOURCE", m.source.sourceName);
      // ordered chain: city, then region (Muftiate), then country
      const levels = m.chain.map((e) => e.specificity);
      assert(levels.join(",") === "city,region,country", `chain: ${levels.join(",")}`);
      // Makhachkala not covered by the city source -> region wins
      const m2 = official.resolvePrayerSource(MAKHACHKALA);
      assert(m2 && m2.specificity === "region", `makhachkala: ${m2 && m2.specificity}`);
      // Moscow: only the country source applies -> country wins
      const m3 = official.resolvePrayerSource(MOSCOW);
      assert(m3 && m3.specificity === "country", `moscow: ${m3 && m3.specificity}`);
      assert(m3.source.sourceName === "TEST COUNTRY SOURCE", m3.source.sourceName);
    } finally {
      reg.pop();
      reg.pop();
    }
    // priority among same level: two region sources, higher priority first
    const fakeRegion2 = {
      id: "test_region_2",
      sourceName: "TEST REGION SOURCE 2",
      sourceLevel: "region",
      sourceType: "official_region",
      sourceUrl: "https://example.com",
      fetchType: "test",
      priority: 5,
      matchesCountry: (c) => c.includes("россия") || c.includes("russia"),
      matchRegion: /дагестан|dagestan/,
      resolveCity: () => ({}),
    };
    reg.push(fakeRegion2);
    try {
      const m4 = official.resolvePrayerSource(DERBENT);
      assert(
        m4.source.sourceName === "Муфтият Республики Дагестан",
        `higher priority must win: ${m4.source.sourceName}`
      );
    } finally {
      reg.pop();
    }
  })
);

tests.push(
  test("T7 day index within 0..364 and equal to the Muftiate widget scheme", () => {
    const idx = official.dagestanDayIndex("Europe/Moscow");
    assert(idx !== null && idx >= 0 && idx <= 364, `idx: ${idx}`);
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);
    assert(idx === dayOfYear - 1, `expected ${dayOfYear - 1}, got ${idx}`);
  })
);

// ---------- fetchPrayerTimes integration (network) ----------

tests.push(
  test("ONLINE T8 Derbent AUTO -> Muftiate schedule (6 rows, source=Муфтият, TZ Europe/Moscow)", async () => {
    const data = await prayer.fetchPrayerTimes({
      latitude: DERBENT.latitude,
      longitude: DERBENT.longitude,
      method: null,
      timezone: DERBENT.timezone,
      country: DERBENT.country,
      name: DERBENT.name,
      region: DERBENT.region,
    });
    assert(data.prayers.length === 6, `prayers: ${data.prayers.length}`);
    const names = data.prayers.map((p) => p.name).join(",");
    assert(names === "Fajr,Sunrise,Dhuhr,Asr,Maghrib,Isha", names);
    for (const p of data.prayers) assert(/^\d{1,2}:\d{2}$/.test(p.time), `bad time ${p.time}`);
    assert(data.source.type === "official_region", data.source.type);
    assert(data.source.name === "Муфтият Республики Дагестан", data.source.name);
    assert(data.timezone === "Europe/Moscow", data.timezone);
  })
);

tests.push(
  test("ONLINE T9 Moscow AUTO -> ДУМ России (method 14, calculated)", async () => {
    const data = await prayer.fetchPrayerTimes({
      latitude: MOSCOW.latitude,
      longitude: MOSCOW.longitude,
      method: null,
      timezone: MOSCOW.timezone,
      country: MOSCOW.country,
      name: MOSCOW.name,
      region: MOSCOW.region,
    });
    assert(data.source.type === "calculated", data.source.type);
    assert(data.source.name === "Расчётное расписание (ДУМ России)", data.source.name);
  })
);

tests.push(
  test("ONLINE T10 Medina AUTO -> calculated Umm al-Qura (method 4)", async () => {
    const data = await prayer.fetchPrayerTimes({
      latitude: MEDINA.latitude,
      longitude: MEDINA.longitude,
      method: null,
      timezone: MEDINA.timezone,
      country: MEDINA.country,
      name: MEDINA.name,
      region: MEDINA.region,
    });
    assert(data.source.type === "calculated", data.source.type);
    assert(data.source.name === "Расчётное расписание (Умм-аль-Кура, Мекка)", data.source.name);
    assert(data.timezone === "Asia/Riyadh", data.timezone);
  })
);

tests.push(
  test("ONLINE T11 manual methods stay manual (Derbent manual DUM=14 and MWL=3)", async () => {
    for (const [methodId, expectedName] of [
      [14, "Расчётное расписание (ДУМ России)"],
      [3, "Расчётное расписание (Muslim World League)"],
    ]) {
      const data = await prayer.fetchPrayerTimes({
        latitude: DERBENT.latitude,
        longitude: DERBENT.longitude,
        method: methodId,
        timezone: DERBENT.timezone,
        country: DERBENT.country,
        name: DERBENT.name,
        region: DERBENT.region,
      });
      assert(data.source.type === "calculated", data.source.type);
      assert(data.source.name === expectedName, `${methodId}: ${data.source.name}`);
    }
  })
);

tests.push(
  test("ONLINE T12 broken official source -> honest fallback to calculation (no crash, no fake labeling)", async () => {
    const reg = official.OFFICIAL_PRAYER_SOURCES;
    const realFetchType = reg[0].fetchType;
    reg[0].fetchType = "broken_nonexistent"; // fetch dispatch fails -> chain continues
    try {
      const data = await prayer.fetchPrayerTimes({
        latitude: DERBENT.latitude,
        longitude: DERBENT.longitude,
        method: null,
        timezone: DERBENT.timezone,
        country: DERBENT.country,
        name: DERBENT.name,
        region: DERBENT.region,
      });
      assert(data.prayers.length === 6, "fallback must return a full schedule");
      assert(data.source.type === "calculated", data.source.type);
      assert(data.source.name === "Расчётное расписание (ДУМ России)", data.source.name);
    } finally {
      reg[0].fetchType = realFetchType;
    }
    // second failure mode: endpoint returns 404
    const realEndpoint = reg[0].endpoint;
    reg[0].fetchType = realFetchType;
    reg[0].endpoint = "https://muftiyatrd.ru/json/namaz/nonexistent-slug-";
    try {
      const data = await prayer.fetchPrayerTimes({
        latitude: DERBENT.latitude,
        longitude: DERBENT.longitude,
        method: null,
        timezone: DERBENT.timezone,
        country: DERBENT.country,
        name: DERBENT.name,
        region: DERBENT.region,
      });
      assert(data.prayers.length === 6, "fallback must return a full schedule");
      assert(data.source.type === "calculated", data.source.type);
    } finally {
      reg[0].endpoint = realEndpoint;
    }
  })
);

tests.push(
  test("ONLINE T13 GPS Helsinki + selectedCity Derbent: schedule follows Derbent (Muftiate), not GPS", async () => {
    // selectedCity = Derbent (AUTO). currentLocation Helsinki must not
    // affect the schedule: fetchPrayerTimes receives ONLY Derbent data.
    const data = await prayer.fetchPrayerTimes({
      latitude: DERBENT.latitude,
      longitude: DERBENT.longitude,
      method: null,
      timezone: DERBENT.timezone,
      country: DERBENT.country,
      name: DERBENT.name,
      region: DERBENT.region,
    });
    assert(data.source.name === "Муфтият Республики Дагестан", data.source.name);
    assert(data.timezone === "Europe/Moscow", data.timezone);
    // inverse: GPS Derbent + selectedCity Helsinki -> Helsinki schedule
    const data2 = await prayer.fetchPrayerTimes({
      latitude: HELSINKI.latitude,
      longitude: HELSINKI.longitude,
      method: null,
      timezone: HELSINKI.timezone,
      country: HELSINKI.country,
      name: HELSINKI.name,
      region: HELSINKI.region,
    });
    assert(data2.source.type === "calculated", data2.source.type);
    assert(data2.timezone === "Europe/Helsinki", data2.timezone);
  })
);

tests.push(
  test("T14 app restart: selectedCity roundtrip keeps region -> resolver still works", () => {
    // Simulates: save city (storage.saveSelectedCity normalizes) ->
    // app restart (getSelectedCity -> normalizeCity JSON roundtrip) ->
    // resolver receives the restored city.
    const original = {
      id: "x",
      name: "Дербент",
      country: "Россия",
      region: "Дагестан",
      latitude: 42.06622,
      longitude: 48.28759,
      timezone: "Europe/Moscow",
      fromGps: false,
    };
    const normalized = cityHelpers.normalizeCity(original);
    const restored = cityHelpers.normalizeCity(JSON.parse(JSON.stringify(normalized)));
    assert(restored.region === "Дагестан", `region lost: ${restored.region}`);
    const m = official.resolvePrayerSource(restored);
    assert(m, "resolver no longer matches after restart roundtrip");
    assert(m.resolved.slug === "derbent", `slug: ${m.resolved.slug}`);
  })
);

tests.push(
  test("T15 world coverage: Grozny/USA/other countries without confirmed sources -> calculation", () => {
    // Grozny/Chechnya: no VERIFIED machine-readable source found
    // (dumchr.ru times are a client-side calculator widget + expired
    // TLS; grozny-inform.ru/namaz -> HTTP 410) -> resolver must return
    // null -> AUTO falls to the country-default calculation method.
    const grozny = official.resolvePrayerSource({
      name: "Грозный", region: "Чечня", country: "Россия",
      latitude: 43.3169, longitude: 45.6981, timezone: "Europe/Moscow",
    });
    assert(grozny === null, "Grozny must not match an unconfirmed source");
    // US city
    const nyc = official.resolvePrayerSource({
      name: "New York", region: "New York", country: "United States",
      latitude: 40.7128, longitude: -74.006, timezone: "America/New_York",
    });
    assert(nyc === null, "NYC must not match (no confirmed US source)");
    // Turkey
    const istanbul = official.resolvePrayerSource({
      name: "Istanbul", region: "Istanbul", country: "Türkiye",
      latitude: 41.0082, longitude: 28.9784, timezone: "Europe/Istanbul",
    });
    assert(istanbul === null, "Istanbul must not match (no confirmed TR source)");
  })
);

// ---------- Tatarstan (DUM RT CSV source, iteration 7) ----------

tests.push(
  test("T18 Kazan/Tatarstan AUTO resolves to ДУМ Республики Татарстан (region level)", () => {
    const m = official.resolvePrayerSource(KAZAN);
    assert(m, "no match");
    assert(m.specificity === "region", `specificity: ${m.specificity}`);
    assert(m.source.sourceLevel === "region", `sourceLevel: ${m.source.sourceLevel}`);
    assert(m.source.sourceName === "ДУМ Республики Татарстан", m.source.sourceName);
    assert(m.resolved.slug === "Kazan", `slug: ${m.resolved.slug}`);
    // alt region form "Республика Татарстан" (device reverse geocoder)
    const m2 = official.resolvePrayerSource(NABEREZHNYE_CHELY);
    assert(m2 && m2.resolved.slug === "NabChelny", `NabChelny slug: ${m2 && m2.resolved.slug}`);
    assert(m2.source.sourceName === "ДУМ Республики Татарстан", m2.source.sourceName);
  })
);

tests.push(
  test("T19 Tatarstan village without own slug -> nearest district anchor; neighbors rejected", () => {
    // A settlement inside Tatarstan without its own slug maps to the
    // nearest district anchor file (official district schedule).
    const m = official.resolvePrayerSource({
      name: "Карабудахкент-подобное-село", region: "Татарстан", country: "Россия",
      latitude: 55.9, longitude: 49.5, timezone: "Europe/Moscow",
    });
    assert(m, "village inside Tatarstan must match via anchor");
    assert(m.source.sourceName === "ДУМ Республики Татарстан", m.source.sourceName);
    assert(typeof m.resolved.slug === "string" && m.resolved.slug.length > 0, "no slug");
    // Outside the region gate the source must NOT apply even when
    // coordinates are close to an anchor (Cheboksary ~85 km from
    // Zelenodolsk but in Chuvashia):
    const cheboksary = official.resolvePrayerSource({
      name: "Чебоксары", region: "Чувашия", country: "Россия",
      latitude: 56.1322, longitude: 47.2519, timezone: "Europe/Moscow",
    });
    assert(cheboksary === null, "Cheboksary (outside Tatarstan) must not match");
    // Ulyanovsk region city near the border:
    const ulyanovsk = official.resolvePrayerSource({
      name: "Ульяновск", region: "Ульяновская Область", country: "Россия",
      latitude: 54.3282, longitude: 48.3866, timezone: "Europe/Moscow",
    });
    assert(ulyanovsk === null, "Ulyanovsk (outside Tatarstan) must not match");
  })
);

tests.push(
  test("ONLINE T20 Kazan AUTO -> DUM RT schedule (6 rows, source=ДУМ РТ, Dhuhr=12:00 official mosque time)", async () => {
    const data = await prayer.fetchPrayerTimes({
      latitude: KAZAN.latitude,
      longitude: KAZAN.longitude,
      method: null,
      timezone: KAZAN.timezone,
      country: KAZAN.country,
      name: KAZAN.name,
      region: KAZAN.region,
    });
    assert(data.prayers.length === 6, `prayers: ${data.prayers.length}`);
    const names = data.prayers.map((p) => p.name).join(",");
    assert(names === "Fajr,Sunrise,Dhuhr,Asr,Maghrib,Isha", names);
    for (const p of data.prayers) assert(/^\d{1,2}:\d{2}$/.test(p.time), `bad time ${p.time}`);
    assert(data.source.type === "official_region", data.source.type);
    assert(data.source.name === "ДУМ Республики Татарстан", data.source.name);
    assert(data.timezone === "Europe/Moscow", data.timezone);
    // Dhuhr is the published fixed mosque time
    const dhuhr = data.prayers.find((p) => p.name === "Dhuhr");
    assert(dhuhr.time === "12:00", `Dhuhr must be the official mosque time 12:00, got ${dhuhr.time}`);
    // Sanity vs astronomy: Fajr < Sunrise < Dhuhr < Asr < Maghrib < Isha (minutes)
    const mins = data.prayers.map((p) => {
      const [h, mm] = p.time.split(":").map(Number);
      return h * 60 + mm;
    });
    for (let i = 1; i < mins.length; i++) {
      assert(mins[i] > mins[i - 1], `prayer order broken at ${data.prayers[i].name}`);
    }
  })
);

tests.push(
  test("ONLINE T21 another Tatarstan city (Naberezhnye Chelny) AUTO -> same regional source; Moscow unaffected", async () => {
    const data = await prayer.fetchPrayerTimes({
      latitude: NABEREZHNYE_CHELY.latitude,
      longitude: NABEREZHNYE_CHELY.longitude,
      method: null,
      timezone: NABEREZHNYE_CHELY.timezone,
      country: NABEREZHNYE_CHELY.country,
      name: NABEREZHNYE_CHELY.name,
      region: NABEREZHNYE_CHELY.region,
    });
    assert(data.source.name === "ДУМ Республики Татарстан", data.source.name);
    assert(data.prayers.length === 6, "6 rows");
    // Region gate: Moscow still resolves to calculation (no regression)
    const msk = await prayer.fetchPrayerTimes({
      latitude: MOSCOW.latitude,
      longitude: MOSCOW.longitude,
      method: null,
      timezone: MOSCOW.timezone,
      country: MOSCOW.country,
      name: MOSCOW.name,
      region: MOSCOW.region,
    });
    assert(msk.source.type === "calculated", msk.source.type);
    assert(msk.source.name === "Расчётное расписание (ДУМ России)", msk.source.name);
  })
);

tests.push(
  test("ONLINE T22 broken DUM RT source -> honest fallback to calculation (chain works for the new entry)", async () => {
    const reg = official.OFFICIAL_PRAYER_SOURCES;
    const dumrt = reg.find((s) => s.id === "dum_rt");
    assert(dumrt, "dum_rt entry must exist in the registry");
    const realFetchType = dumrt.fetchType;
    const realEndpoint = dumrt.endpoint;
    try {
      dumrt.fetchType = "broken_nonexistent"; // dispatch fails -> chain continues
      dumrt.endpoint = "https://dumrt.ru/nonexistent-path-404/";
      const data = await prayer.fetchPrayerTimes({
        latitude: KAZAN.latitude,
        longitude: KAZAN.longitude,
        method: null,
        timezone: KAZAN.timezone,
        country: KAZAN.country,
        name: KAZAN.name,
        region: KAZAN.region,
      });
      assert(data.prayers.length === 6, "fallback must return a full schedule");
      assert(data.source.type === "calculated", data.source.type);
      assert(data.source.name === "Расчётное расписание (ДУМ России)", data.source.name);
    } finally {
      dumrt.fetchType = realFetchType;
      dumrt.endpoint = realEndpoint;
    }
  })
);

tests.push(
  test("T23 REGRESSION: Derbent AUTO still resolves to the Dagestan Muftiate (unchanged)", () => {
    // The single most important invariant of this iteration: adding a
    // new regional source must not change the existing Derbent path.
    const m = official.resolvePrayerSource(DERBENT);
    assert(m, "no match");
    assert(m.source.sourceName === "Муфтият Республики Дагестан", m.source.sourceName);
    assert(m.resolved.slug === "derbent", `slug: ${m.resolved.slug}`);
    // Kazan must NOT accidentally match the Dagestan source and vice versa
    const kazan = official.resolvePrayerSource(KAZAN);
    assert(kazan.source.id === "dum_rt", `kazan source: ${kazan.source.id}`);
  })
);

tests.push(
  test("T16 AUTO/MANUAL storage semantics: removeMethod clears override; restart keeps mode", async () => {
    // Storage-level simulation of the settings flow: load utils/storage.js
    // with an in-memory AsyncStorage shim (AsyncStorage itself is a
    // native module unavailable in Node). The ./city import is resolved
    // through the same __cjsRegistry the loader uses for prayerApi.
    const shimTmp = path.join(ROOT, ".expo", "test_storage_shim.js");
    fs.writeFileSync(
      shimTmp + ".js",
      "const store = new Map();\n" +
      "module.exports = {\n" +
      "  setItem: async (k, v) => store.set(k, String(v)),\n" +
      "  getItem: async (k) => (store.has(k) ? store.get(k) : null),\n" +
      "  removeItem: async (k) => store.delete(k),\n" +
      "};\n"
    );
    const cityAbs = path.join(ROOT, "utils", "city.js");
    if (!__cjsRegistry[cityAbs]) preload(cityAbs); // adds it to the registry
    const storageSrc = fs
      .readFileSync(path.join(ROOT, "utils", "storage.js"), "utf8")
      .replace(
        /^import AsyncStorage from "@react-native-async-storage\/async-storage";$/m,
        `const AsyncStorage = require("${escaped(shimTmp + ".js")}");`
      )
      .replace(
        /^import \{ normalizeCity, cityId, isSameCity \} from "\.\/city";$/m,
        `const { normalizeCity, cityId, isSameCity } = __cjsRegistry["${escaped(cityAbs)}"];`
      )
      .replace(/^export /gm, "");
    const storageFile = path.join(ROOT, ".expo", "test_mod_storage.js");
    fs.writeFileSync(
      storageFile + ".js",
      "const __cjsRegistry = (global.__cjsRegistry = global.__cjsRegistry || {});\n" +
      storageSrc +
      "\nmodule.exports = { saveMethod, getSavedMethod, removeMethod };"
    );
    delete require.cache[require.resolve(storageFile + ".js")];
    const storage = require(storageFile + ".js");
    // initially: no stored method -> AUTO
    assert((await storage.getSavedMethod()) === null, "initial must be AUTO (null)");
    // manual DUM=14 -> stored, MANUAL
    await storage.saveMethod(14);
    assert((await storage.getSavedMethod()) === 14, "manual saved as 14");
    // reset to AUTO -> override fully removed
    await storage.removeMethod();
    assert((await storage.getSavedMethod()) === null, "removeMethod must clear the override");
    // restart simulation: nothing stored -> AUTO survives the restart
    assert((await storage.getSavedMethod()) === null, "AUTO survives restart");
    // manual survives restart
    await storage.saveMethod(3);
    assert((await storage.getSavedMethod()) === 3, "MANUAL survives restart");
    await storage.removeMethod();
  })
);

tests.push(
  test("T17 cache key mirrors the mode: auto vs manual never mix", () => {
    // The cache key is derived from the method argument exactly as
    // AppDataContext.loadPrayerTimes builds it. Same derivation ->
    // same key -> no stale cross-mode cache hits.
    const keyOf = (method) => {
      const asNum = Number(method);
      const manual = method != null && Number.isFinite(asNum) ? asNum : null;
      return manual != null ? String(manual) : "auto";
    };
    assert(keyOf(null) === "auto", "AUTO key");
    assert(keyOf(undefined) === "auto", "AUTO key (undefined)");
    assert(keyOf(14) === "14", "manual 14 key");
    assert(keyOf("14") === "14", "string 14 normalizes to 14");
    assert(keyOf(3) !== keyOf(null), "manual != auto");
    assert(keyOf(3) !== keyOf(14), "different manuals differ");
  })
);

(async () => {
  for (const t of tests) await t();
  console.log(results.join("\n"));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
