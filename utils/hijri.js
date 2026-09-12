// Hijri (Islamic) date conversion — Kuwaiti algorithm, a widely used
// civil (arithmetical) tabular calendar. This is an ALGORITHMIC
// conversion, not moon-sighting: the real Hijri day starts at sunset
// and is set by actual lunar observation, so dates can differ by
// +/-1 day from the official calendar. The app honestly labels this.

const HIJRI_MONTHS = [
  "Мухаррам",
  "Сафар",
  "Раби аль-авваль",
  "Раби ас-сани",
  "Джумада аль-уля",
  "Джумада ас-сания",
  "Раджаб",
  "Шаабан",
  "Рамадан",
  "Шавваль",
  "Зу-ль-каада",
  "Зу-ль-хиджа",
];

// Gregorian -> Julian day number (Gregorian calendar only; the app
// only handles modern dates).
function gregorianToJd(year, month, day) {
  return (
    Math.floor((1461 * (year + 4800 + Math.floor((month - 14) / 12))) / 4) +
    Math.floor((367 * (month - 2 - 12 * Math.floor((month - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((year + 4900 + Math.floor((month - 14) / 12)) / 100)) / 4) +
    day -
    32075
  );
}

// Gregorian {year, month, day} -> Hijri {day, month, year}.
// Pure function, safe for unit tests.
export function gregorianToHijri(year, month, day) {
  const jd = gregorianToJd(year, month, day);
  const l0 = jd - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  let l = l0 - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const hijriMonth = Math.floor((24 * l) / 709);
  const hijriDay = l - Math.floor((709 * hijriMonth) / 24);
  const hijriYear = 30 * n + j - 30;
  return { day: Math.floor(hijriDay), month: Math.floor(hijriMonth), year: hijriYear };
}

// Hijri month name by 1-based month index (1 = Мухаррам).
export function hijriMonthName(month) {
  return HIJRI_MONTHS[((month - 1) % 12 + 12) % 12];
}

// Formatted Hijri date, day -> month -> year:
// e.g. "29 Раби аль-авваль 1448". Pure, testable.
export function formatHijriDate({ day, month, year }) {
  if (!day || !month || !year) return null;
  return `${day} ${hijriMonthName(month)} ${year}`;
}
