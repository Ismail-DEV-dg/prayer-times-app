// Quran text + audio sources for Read mode.
//
// Strictly 2 APIs are used (all 3rd-party services like Quran.com are removed):
// - In Russia (РФ):
//     Text Primary:   https://alquran.api.alislam.ru/v1 (timeout 2s)
//     Text Fallback:  https://api.alquran.cloud/v1
//     Audio Primary:  https://cdn.alislam.ru/quran/audio/128/... (timeout 2s)
//     Audio Fallback: https://cdn.islamic.network/quran/audio/128/... (AlQuran Cloud CDN)
// - Outside Russia:
//     Text Primary:   https://api.alquran.cloud/v1 (timeout 2s)
//     Text Fallback:  https://alquran.api.alislam.ru/v1
//     Audio Primary:  https://everyayah.com/data/... (timeout 2s)
//     Audio Fallback: https://cdn.islamic.network/quran/audio/128/... (AlQuran Cloud CDN)
//
// Race & Fallback rules:
// - Primary API starts immediately. If no response within 2s (or early failure),
//   Fallback API starts immediately.
// - First successful response wins and cancels the other request via AbortController.
// - Overall timeout is 10s.
// - Listen mode is completely untouched.

export const PRIMARY_TEXT_TIMEOUT_MS = 2000;
export const FALLBACK_1_TIMEOUT_MS = 2000;
export const TOTAL_TIMEOUT_MS = 10000;
export const PRIMARY_AUDIO_TIMEOUT_MS = 2000;

const ALISLAM_API_BASE = "https://alquran.api.alislam.ru/v1";
const ALQURAN_CLOUD_API_BASE = "https://api.alquran.cloud/v1";
const ARABIC_EDITION = "quran-uthmani";
const TRANSLATION_EDITION = "ru.kuliev"; // Elmir Kuliev Russian translation
const TRANSLITERATION_EDITION = "ru.transliteration";

// Reciters verified on CDNs (HTTP 200 on sample ayahs).
export const RECITERS = [
  { id: "ar.alafasy", name: "Мишари Рашид аль-Афаси" },
  { id: "ar.husary", name: "Махмуд Халиль аль-Хусари" },
  { id: "ar.minshawi", name: "Мухаммад Сиддик аль-Миншави" },
];

export const DEFAULT_RECITER = "ar.alafasy";

const RECITER_FALLBACK_MAP = {
  "ar.alafasy": { id: "ar.alafasy", bitrate: 128 },
  "ar.husary": { id: "ar.husary", bitrate: 128 },
  "ar.minshawi": { id: "ar.minshawi", bitrate: 128 },
};

export function normalizeReciterId(reciterId) {
  if (!reciterId || typeof reciterId !== "string") return DEFAULT_RECITER;
  const lower = reciterId.toLowerCase().trim();
  if (lower.includes("husary")) return "ar.husary";
  if (lower.includes("minshaw")) return "ar.minshawi";
  if (lower.includes("afasy") || lower.includes("alafasy")) return "ar.alafasy";
  return DEFAULT_RECITER;
}

export function isValidSurahNumber(n) {
  return Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= 114;
}

// Determines if user is located in Russia based on selected city or device timezone
export function isUserInRussia(city = null) {
  if (city && city.country) {
    return /russia|россия|российская|рф/i.test(city.country);
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (
      tz.startsWith("Europe/Moscow") ||
      tz.startsWith("Europe/Samara") ||
      tz.startsWith("Europe/Kaliningrad") ||
      tz.startsWith("Europe/Volgograd") ||
      tz.startsWith("Europe/Saratov") ||
      tz.startsWith("Europe/Ulyanovsk") ||
      tz.startsWith("Europe/Astrakhan") ||
      tz.startsWith("Europe/Kirov") ||
      tz.startsWith("Asia/Yekaterinburg") ||
      tz.startsWith("Asia/Omsk") ||
      tz.startsWith("Asia/Novosibirsk") ||
      tz.startsWith("Asia/Barnaul") ||
      tz.startsWith("Asia/Tomsk") ||
      tz.startsWith("Asia/Novokuznetsk") ||
      tz.startsWith("Asia/Krasnoyarsk") ||
      tz.startsWith("Asia/Irkutsk") ||
      tz.startsWith("Asia/Chita") ||
      tz.startsWith("Asia/Yakutsk") ||
      tz.startsWith("Asia/Khandyga") ||
      tz.startsWith("Asia/Vladivostok") ||
      tz.startsWith("Asia/Ust-Nera") ||
      tz.startsWith("Asia/Magadan") ||
      tz.startsWith("Asia/Sakhalin") ||
      tz.startsWith("Asia/Srednekolymsk") ||
      tz.startsWith("Asia/Kamchatka") ||
      tz.startsWith("Asia/Anadyr")
    ) {
      return true;
    }
  } catch (e) {}
  return false;
}

// Exactly 2 sources race helper:
// 1. Starts primary source immediately.
// 2. If primary does not respond within primary timeout (2s) or fails early, starts fallback.
// 3. Whichever succeeds first wins and cancels the other in-flight request using AbortController.
// 4. Overall timeout (10s) protects against hanging requests.
function fetchWithFallback({ primary, fallback, totalTimeoutMs = TOTAL_TIMEOUT_MS, label = "QuranText", externalSignal = null }) {
  return new Promise((resolve, reject) => {
    if (externalSignal && externalSignal.aborted) {
      return reject(new Error("ABORTED"));
    }

    let settled = false;
    let fallbackStarted = false;
    const primaryController = new AbortController();
    const fallbackController = new AbortController();
    let primaryTimer = null;
    let totalTimer = null;
    const startTime = Date.now();

    function cleanup() {
      if (primaryTimer) clearTimeout(primaryTimer);
      if (totalTimer) clearTimeout(totalTimer);
      if (externalSignal && typeof externalSignal.removeEventListener === "function") {
        externalSignal.removeEventListener("abort", handleExternalAbort);
      }
    }

    function handleExternalAbort() {
      if (settled) return;
      settled = true;
      cleanup();
      primaryController.abort();
      fallbackController.abort();
      reject(new Error("ABORTED"));
    }

    if (externalSignal && typeof externalSignal.addEventListener === "function") {
      externalSignal.addEventListener("abort", handleExternalAbort);
    }

    function handleSuccess(data, sourceName, winnerController, loserController) {
      if (settled) return;
      settled = true;
      cleanup();
      loserController.abort();
      const duration = Date.now() - startTime;
      console.log(`[${label}] ${sourceName} API responded in ${duration}ms`);
      resolve(data);
    }

    let primaryFinished = false;
    let primaryError = null;
    let fallbackFinished = false;
    let fallbackError = null;

    function checkBothFailed() {
      if (settled) return;
      if (primaryFinished && fallbackFinished) {
        settled = true;
        cleanup();
        console.log(`[${label}] Both sources failed in ${Date.now() - startTime}ms`);
        reject(primaryError || fallbackError || new Error("API_ERROR"));
      }
    }

    function startFallback() {
      if (settled || fallbackStarted) return;
      fallbackStarted = true;
      fallback.fn(fallbackController.signal)
        .then((data) => {
          fallbackFinished = true;
          handleSuccess(data, fallback.name, fallbackController, primaryController);
        })
        .catch((err) => {
          fallbackFinished = true;
          fallbackError = err;
          checkBothFailed();
        });
    }

    // 1. Start primary immediately
    primary.fn(primaryController.signal)
      .then((data) => {
        primaryFinished = true;
        handleSuccess(data, primary.name, primaryController, fallbackController);
      })
      .catch((err) => {
        primaryFinished = true;
        primaryError = err;
        if (!settled) {
          if (!fallbackStarted) {
            startFallback();
          } else {
            checkBothFailed();
          }
        }
      });

    // 2. Primary timeout (2s): if no response within timeout, immediately trigger fallback
    primaryTimer = setTimeout(() => {
      if (!settled && !fallbackStarted) {
        console.log(`[${label}] ${primary.name} did not respond within ${primary.timeoutMs}ms, triggering fallback`);
        startFallback();
      }
    }, primary.timeoutMs);

    // 3. Overall timeout (10s)
    totalTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        primaryController.abort();
        fallbackController.abort();
        console.log(`[${label}] Overall timeout of ${totalTimeoutMs}ms reached`);
        reject(new Error("NETWORK_ERROR"));
      }
    }, totalTimeoutMs);
  });
}

// Fetch Surah list from AlQuran Cloud or AlIslam mirror
async function fetchSurahListFromBase(apiBase, signal) {
  const response = await fetch(`${apiBase}/surah`, { signal });
  if (!response.ok) throw new Error("API_ERROR");
  const json = await response.json();
  if (json.code !== 200 || !Array.isArray(json.data)) throw new Error("API_ERROR");
  return json.data.map((s) => ({
    number: s.number,
    name: s.name,
    englishName: s.englishName,
    englishNameTranslation: s.englishNameTranslation,
    numberOfAyahs: s.numberOfAyahs,
    revelationType: s.revelationType,
  }));
}

// Fetch single Surah with Arabic text, Russian translation, and transliteration from AlQuran Cloud or AlIslam mirror
async function fetchSurahFromBase(apiBase, num, signal) {
  const url = `${apiBase}/surah/${num}/editions/${ARABIC_EDITION},${TRANSLATION_EDITION},${TRANSLITERATION_EDITION}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("API_ERROR");
  const json = await response.json();
  if (json.code !== 200 || !Array.isArray(json.data) || json.data.length < 2) {
    throw new Error("API_ERROR");
  }

  const arabic = json.data[0];
  const translation = json.data[1];
  const transliteration = json.data[2] || null;
  const ayahCount = arabic.ayahs.length;
  if (ayahCount === 0 || translation.ayahs.length !== ayahCount) {
    throw new Error("API_ERROR");
  }

  const ayahs = arabic.ayahs.map((a, i) => {
    const t = translation.ayahs[i];
    const tr = transliteration?.ayahs?.[i];
    if (t.numberInSurah !== a.numberInSurah) throw new Error("API_ERROR");
    return {
      numberInSurah: a.numberInSurah,
      globalNumber: a.number,
      arabic: a.text,
      translation: t.text || "",
      transliteration: tr?.text ? tr.text.replace(/\s+/g, " ").trim() : "",
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

// Surah list (metadata only, ~5 KB).
export async function fetchSurahList(city = null) {
  const inRF = isUserInRussia(city);
  const primary = inRF
    ? { name: "Primary (AlIslam)", fn: (sig) => fetchSurahListFromBase(ALISLAM_API_BASE, sig), timeoutMs: PRIMARY_TEXT_TIMEOUT_MS }
    : { name: "Primary (AlQuranCloud)", fn: (sig) => fetchSurahListFromBase(ALQURAN_CLOUD_API_BASE, sig), timeoutMs: PRIMARY_TEXT_TIMEOUT_MS };

  const fallback = inRF
    ? { name: "Fallback (AlQuranCloud)", fn: (sig) => fetchSurahListFromBase(ALQURAN_CLOUD_API_BASE, sig) }
    : { name: "Fallback (AlIslam)", fn: (sig) => fetchSurahListFromBase(ALISLAM_API_BASE, sig) };

  return fetchWithFallback({ primary, fallback, label: "QuranSurahList" });
}

// One surah with Arabic text + translation, combined per ayah.
export async function fetchSurah(surahNumber, city = null) {
  const num = Number(surahNumber);
  if (!isValidSurahNumber(num)) throw new Error("INVALID_SURAH");

  const inRF = isUserInRussia(city);
  const primary = inRF
    ? { name: "Primary (AlIslam)", fn: (sig) => fetchSurahFromBase(ALISLAM_API_BASE, num, sig), timeoutMs: PRIMARY_TEXT_TIMEOUT_MS }
    : { name: "Primary (AlQuranCloud)", fn: (sig) => fetchSurahFromBase(ALQURAN_CLOUD_API_BASE, num, sig), timeoutMs: PRIMARY_TEXT_TIMEOUT_MS };

  const fallback = inRF
    ? { name: "Fallback (AlQuranCloud)", fn: (sig) => fetchSurahFromBase(ALQURAN_CLOUD_API_BASE, num, sig) }
    : { name: "Fallback (AlIslam)", fn: (sig) => fetchSurahFromBase(ALISLAM_API_BASE, num, sig) };

  return fetchWithFallback({ primary, fallback, label: "QuranSurah" });
}

// PRIMARY per-ayah audio URL:
// - For Russia: alislam.ru audio CDN (https://cdn.alislam.ru/quran/audio/128/...)
// - Outside Russia: everyayah.com (https://everyayah.com/data/...)
export function getAyahAudioUrl(surahNumber, ayahNumber, reciterId = DEFAULT_RECITER, globalAyahNumber = null, city = null) {
  const inRF = isUserInRussia(city);
  const rec = normalizeReciterId(reciterId);
  const num = Number(globalAyahNumber);

  // In Russia: use cdn.alislam.ru if globalAyahNumber is present
  if (inRF && Number.isInteger(num) && num >= 1 && num <= 6236) {
    const config = RECITER_FALLBACK_MAP[rec] || { id: "ar.alafasy", bitrate: 128 };
    return `https://cdn.alislam.ru/quran/audio/${config.bitrate}/${config.id}/${num}.mp3`;
  }

  // Outside Russia (or fallback when globalAyahNumber is not provided): everyayah.com
  const folder =
    rec === "ar.alafasy"
      ? "Alafasy_128kbps"
      : rec === "ar.husary"
      ? "Husary_128kbps"
      : rec === "ar.minshawi"
      ? "Minshawy_Murattal_128kbps"
      : "Alafasy_128kbps";
  const s = Number(surahNumber);
  const a = Number(ayahNumber);
  if (!Number.isInteger(s) || s < 1 || s > 114) return null;
  if (!Number.isInteger(a) || a < 1 || a > 286) return null;
  return `https://everyayah.com/data/${folder}/${String(s).padStart(3, "0")}${String(a).padStart(3, "0")}.mp3`;
}

// FALLBACK per-ayah audio URL (AlQuran Cloud / islamic.network CDN):
// Keyed by global ayah number (1..6236) at 128 kbps.
export function getAyahAudioUrlFallback(globalAyahNumber, reciterId = DEFAULT_RECITER) {
  const num = Number(globalAyahNumber);
  if (!Number.isInteger(num) || num < 1 || num > 6236) return null;
  const rec = normalizeReciterId(reciterId);
  const config = RECITER_FALLBACK_MAP[rec] || { id: "ar.alafasy", bitrate: 128 };
  return `https://cdn.islamic.network/quran/audio/${config.bitrate}/${config.id}/${num}.mp3`;
}

// Tafsir Resources definition
export const TAFSIR_RESOURCES = {
  170: {
    id: 170,
    name: "Ас-Саади",
    language: "ru",
    quranComId: 170,
    islamicAppSlug: "ru-tafseer-al-saddi",
  },
  169: {
    id: 169,
    name: "Ибн Касир",
    language: "en",
    quranComId: 169,
    islamicAppSlug: "en-tafisr-ibn-kathir",
  },
};

// Strips HTML tags, converts line breaks, decodes HTML entities and normalizes whitespace
export function cleanTafsirHtml(raw) {
  if (!raw || typeof raw !== "string") return "";
  let str = raw;
  str = str.replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n");
  str = str.replace(/<br\s*[\/]?>/gi, "\n");
  str = str.replace(/<[^>]+>/g, "");
  const entities = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&lt;": "<",
    "&gt;": ">",
    "&laquo;": "«",
    "&raquo;": "»",
    "&mdash;": "—",
    "&ndash;": "–",
    "&#8217;": "'",
    "&#8216;": "'",
    "&#8220;": '"',
    "&#8221;": '"',
    "&#8211;": "–",
    "&#8212;": "—",
  };
  str = str.replace(/&[a-zA-Z0-9#]+;/g, (m) => entities[m] || m);
  str = str.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  str = str.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  str = str.replace(/[ \t]+/g, " ");
  str = str.replace(/\n\s+\n/g, "\n\n");
  str = str.replace(/\n{3,}/g, "\n\n");
  return str.trim();
}

// Fetch Ayah Tafsir with Primary (Quran.com v4) -> Fallback (Islamic.app v1)
// Primary timeout: 4000ms, total timeout: 10000ms.
export async function fetchAyahTafsir(resourceId, surahNumber, ayahNumber, signal = null) {
  const resId = Number(resourceId);
  const surah = Number(surahNumber);
  const ayah = Number(ayahNumber);
  const config = TAFSIR_RESOURCES[resId];
  if (!config) throw new Error("INVALID_TAFSIR_RESOURCE");

  const primary = {
    name: "Primary (Quran.com)",
    fn: async (abortSignal) => {
      const url = `https://api.quran.com/api/v4/tafsirs/${config.quranComId}/by_ayah/${surah}:${ayah}`;
      const response = await fetch(url, { signal: abortSignal });
      if (!response.ok) throw new Error("API_ERROR");
      const json = await response.json();
      const raw = json?.tafsir?.text;
      return cleanTafsirHtml(raw);
    },
    timeoutMs: 4000,
  };

  const fallback = {
    name: "Fallback (Islamic.app)",
    fn: async (abortSignal) => {
      const url = `https://api.islamic.app/v1/quran/tafsirs/${config.islamicAppSlug}?verse_key=${surah}:${ayah}`;
      const response = await fetch(url, { signal: abortSignal });
      if (!response.ok) throw new Error("API_ERROR");
      const json = await response.json();
      const raw = json?.data?.ayahs?.[0]?.text;
      return cleanTafsirHtml(raw);
    },
  };

  return fetchWithFallback({
    primary,
    fallback,
    totalTimeoutMs: 10000,
    label: "AyahTafsir",
    externalSignal: signal,
  });
}

