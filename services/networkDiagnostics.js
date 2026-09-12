// In-app network diagnostics. Runnable ON THE PHONE (from any network,
// including Russia) to measure REAL request times for every source the
// app uses, with per-request logging. No UI changes needed by other
// screens: this module is standalone and side-effect free.
//
// Usage (e.g. from a temporary button or the dev console):
//   import { runDiagnostics, formatDiagnosticsReport } from "../services/networkDiagnostics";
//   const report = await runDiagnostics();
//   console.log(formatDiagnosticsReport(report));
//
// Each request measures: total time, HTTP status, bytes, error/timeout.
// Results are plain JSON-serializable objects so they can be logged or
// shared.

// The exact production endpoints (mirrors services/*).
const SOURCES = [
  { key: "quran_text_surah_list", url: "https://api.alquran.cloud/v1/surah" },
  {
    key: "quran_text_surah_2",
    url: "https://api.alquran.cloud/v1/surah/2/editions/quran-uthmani,ru.kuliev",
  },
  {
    key: "quran_audio_islamic_network_alafasy_64",
    url: "https://cdn.islamic.network/quran/audio/64/ar.alafasy/82.mp3",
  },
  {
    key: "quran_audio_islamic_network_husary_64",
    url: "https://cdn.islamic.network/quran/audio/64/ar.husary/82.mp3",
  },
  {
    key: "quran_audio_islamic_network_minshawi_128",
    url: "https://cdn.islamic.network/quran/audio/128/ar.minshawi/82.mp3",
  },
  {
    key: "quran_audio_everyayah_alafasy",
    url: "https://everyayah.com/data/Alafasy_128kbps/002075.mp3",
  },
  {
    key: "quran_audio_everyayah_minshawi",
    url: "https://everyayah.com/data/Minshawy_Murattal_128kbps/002075.mp3",
  },
  {
    key: "prayer_aladhan",
    url: "https://api.aladhan.com/v1/timings/11-09-2026?latitude=21.4225&longitude=39.8262&method=4",
  },
  {
    key: "geocoding_open_meteo",
    url: "https://geocoding-api.open-meteo.com/v1/search?name=helsinki&count=10&language=ru&format=json",
  },
  {
    key: "qibla_noaa_declination",
    url: "https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination?lat1=60.1699&lon1=24.9384&key=zNEw7&resultFormat=json",
  },
];

const TIMEOUT_MS = 15000;

// One timed request. Resolves even on error/timeout — never throws.
async function timedRequest(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal });
    const ttfb = Date.now() - started;
    let bytes = 0;
    try {
      const body = await response.arrayBuffer();
      bytes = body.byteLength;
    } catch (e) {
      // status still matters; body read failure is recorded as 0 bytes
    }
    return {
      ok: response.ok,
      status: response.status,
      ttfbMs: ttfb,
      totalMs: Date.now() - started,
      bytes,
      error: null,
      timeout: false,
    };
  } catch (e) {
    const timeout = e && e.name === "AbortError";
    return {
      ok: false,
      status: null,
      ttfbMs: null,
      totalMs: Date.now() - started,
      bytes: 0,
      error: timeout ? "TIMEOUT" : "NETWORK_ERROR",
      timeout,
    };
  } finally {
    clearTimeout(timer);
  }
}

function statsOf(values) {
  const nums = values.filter((v) => typeof v === "number");
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  return {
    avg: Math.round(nums.reduce((a, b) => a + b, 0) / nums.length),
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

// Runs every source `runs` times sequentially (default 5), logging
// each individual request. Returns a full report object.
export async function runDiagnostics({ runs = 5, onProgress = null, onlyAudio = false } = {}) {
  const sources = onlyAudio
    ? SOURCES.filter((s) => s.key.startsWith("quran_audio"))
    : SOURCES;
  const report = { startedAt: new Date().toISOString(), runs, sources: [] };

  for (const source of sources) {
    const results = [];
    for (let i = 0; i < runs; i++) {
      const r = await timedRequest(source.url);
      results.push(r);
      if (onProgress) {
        try {
          onProgress({ source: source.key, attempt: i + 1, ...r });
        } catch (e) {
          // progress callback must never break diagnostics
        }
      }
      // small pause so we don't hammer the servers
      await new Promise((res) => setTimeout(res, 300));
    }
    report.sources.push({
      key: source.key,
      url: source.url,
      results,
      summary: {
        requests: results.length,
        ok: results.filter((r) => r.ok).length,
        errors: results.filter((r) => r.error && !r.timeout).length,
        timeouts: results.filter((r) => r.timeout).length,
        statuses: [...new Set(results.map((r) => r.status).filter(Boolean))],
        totalMs: statsOf(results.map((r) => r.totalMs)),
        ttfbMs: statsOf(results.map((r) => r.ttfbMs)),
        bytes: statsOf(results.map((r) => r.bytes).filter(Boolean)),
      },
    });
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

// Human-readable one-line-per-source report for logs/console.
export function formatDiagnosticsReport(report) {
  const lines = [
    `Network diagnostics ${report.startedAt} -> ${report.finishedAt} (${report.runs} runs each)`,
  ];
  for (const s of report.sources) {
    const t = s.summary.totalMs;
    const ttfb = s.summary.ttfbMs;
    lines.push(
      `${s.key.padEnd(42)} ok=${s.summary.ok}/${s.summary.requests} ` +
        `err=${s.summary.errors} t/o=${s.summary.timeouts} ` +
        `status=${s.summary.statuses.join("/") || "—"} ` +
        `total(avg/med/min/max)=${t ? `${t.avg}/${t.median}/${t.min}/${t.max}ms` : "—"} ` +
        `ttfb=${ttfb ? `${ttfb.avg}/${ttfb.median}ms` : "—"}`
    );
  }
  return lines.join("\n");
}
