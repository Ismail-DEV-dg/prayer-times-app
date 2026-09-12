// Quran text + audio sources.
//
// Text: AlQuran Cloud API (https://alquran.cloud) — verified source
// serving the standard Uthmani mushaf and published translations.
//
// Audio PRIMARY: everyayah.com per-ayah files (one mp3 per ayah,
// zero-padded surah/ayah segments, 128 kbps). Verified folders:
// Alafasy_128kbps / Husary_128kbps / Minshawy_Murattal_128kbps
// (HTTP 200 on real ayahs; the underscore-less spellings 404).
//
// Audio FALLBACK (OPTIONAL): islamic.network CDN per-ayah files keyed
// by the GLOBAL ayah number (1..6236). Measurably slower and has had
// intermittent 502s, so it is used only when PRIMARY fails.
// The app must work with the fallback removed entirely — the hook
// treats a null/undefined fallback URL as "no fallback".
//
// NO text is ever generated locally. If the source is unreachable the
// caller must show an error — fabricated ayahs are forbidden.

const API_BASE = "https://api.alquran.cloud/v1";
const ARABIC_EDITION = "quran-uthmani";
const TRANSLATION_EDITION = "ru.kuliev"; // Elmir Kuliev translation

// Reciters verified on the CDN (HTTP 200 on sample ayahs).
export const RECITERS = [
  { id: "ar.alafasy", name: "Мишари Рашид аль-Афаси" },
  { id: "ar.husary", name: "Махмуд Халиль аль-Хусари" },
  { id: "ar.minshawi", name: "Мухаммад Сиддик аль-Миншави" },
];

export const DEFAULT_RECITER = "ar.alafasy";

export function isValidSurahNumber(n) {
  return Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= 114;
}

async function fetchWithTimeout(url, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Surah list (metadata only, ~5 KB).
export async function fetchSurahList() {
  const response = await fetchWithTimeout(`${API_BASE}/surah`);
  if (!response.ok) throw new Error("API_ERROR");
  const json = await response.json();
  if (json.code !== 200 || !Array.isArray(json.data)) throw new Error("API_ERROR");
  return json.data.map((s) => ({
    number: s.number,
    name: s.name, // Arabic name
    englishName: s.englishName,
    englishNameTranslation: s.englishNameTranslation,
    numberOfAyahs: s.numberOfAyahs,
    revelationType: s.revelationType,
  }));
}

// One surah with Arabic text + translation, combined per ayah.
// Uses a single request with two editions to keep ayah numbering exact.
export async function fetchSurah(surahNumber) {
  const num = Number(surahNumber);
  if (!isValidSurahNumber(num)) throw new Error("INVALID_SURAH");

  const url = `${API_BASE}/surah/${num}/editions/${ARABIC_EDITION},${TRANSLATION_EDITION}`;
  const response = await fetchWithTimeout(url, 30000);
  if (!response.ok) throw new Error("API_ERROR");
  const json = await response.json();
  if (json.code !== 200 || !Array.isArray(json.data) || json.data.length < 2) {
    throw new Error("API_ERROR");
  }

  const arabic = json.data[0];
  const translation = json.data[1];
  const ayahCount = arabic.ayahs.length;
  if (ayahCount === 0 || translation.ayahs.length !== ayahCount) {
    throw new Error("API_ERROR");
  }

  const ayahs = arabic.ayahs.map((a, i) => {
    const t = translation.ayahs[i];
    if (t.numberInSurah !== a.numberInSurah) throw new Error("API_ERROR");
    return {
      numberInSurah: a.numberInSurah, // exact ayah number within the surah
      globalNumber: a.number, // global ayah number 1..6236 (audio key)
      arabic: a.text,
      translation: t.text || "",
      page: a.page || null,
    };
  });

  return {
    number: arabic.number,
    name: arabic.name,
    englishName: arabic.englishName,
    englishNameTranslation: arabic.englishNameTranslation,
    numberOfAyahs: arabic.numberOfAyahs,
    ayahs,
  };
}

// PRIMARY per-ayah audio URL (everyayah.com). Zero-padded
// surah/ayah segments guarantee that pressing "Ayah 75" plays
// exactly Surah X / Ayah 75.
export function getAyahAudioUrl(surahNumber, ayahNumber, reciterId = DEFAULT_RECITER) {
  const folder =
    reciterId === "ar.alafasy"
      ? "Alafasy_128kbps"
      : reciterId === "ar.husary"
      ? "Husary_128kbps"
      : reciterId === "ar.minshawi"
      ? "Minshawy_Murattal_128kbps"
      : null;
  if (folder == null) return null;
  const s = Number(surahNumber);
  const a = Number(ayahNumber);
  if (!Number.isInteger(s) || s < 1 || s > 114) return null;
  if (!Number.isInteger(a) || a < 1 || a > 286) return null;
  return `https://everyayah.com/data/${folder}/${String(s).padStart(3, "0")}${String(a).padStart(3, "0")}.mp3`;
}

// OPTIONAL FALLBACK per-ayah audio URL (islamic.network CDN), keyed
// by the global ayah number (1..6236). Returned as a plain string;
// callers may pass it (or null) to the audio hook. Removing this
// function and its call site must not affect PRIMARY playback.
export function getAyahAudioUrlFallback(globalAyahNumber, reciterId = DEFAULT_RECITER) {
  const num = Number(globalAyahNumber);
  if (!Number.isInteger(num) || num < 1 || num > 6236) return null;
  return `https://cdn.islamic.network/quran/audio/64/${reciterId}/${num}.mp3`;
}
