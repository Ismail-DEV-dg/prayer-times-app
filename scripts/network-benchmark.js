// Network benchmark for all external sources used by the app.
// Measures REAL HTTP timing per request: DNS, TCP, TLS, TTFB, total
// download, status. Runs N sequential requests per source and prints
// average / median / min / max / errors / timeouts.
//
// Usage: node scripts/network-benchmark.js [quick]
//   quick = 3 requests per source instead of 8.

const dns = require("dns");
const http = require("http");
const https = require("https");
const { URL } = require("url");
const tls = require("tls");

const QUICK = process.argv.includes("quick");
const RUNS = QUICK ? 3 : 8;

// ---------- low-level timing fetch ----------
// Reconnects every run (no keep-alive) to see the full DNS/TCP/TLS
// cost a cold user would experience.
function timedFetch(rawUrl, { method = "GET", headers = {}, body = null, timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    const url = new URL(rawUrl);
    const started = process.hrtime.bigint();
    const mark = () => Number(process.hrtime.bigint() - started) / 1e6; // ms
    const t = { dns: null, tcp: null, tls: null, ttfb: null, total: null, status: null, bytes: null, error: null, timeout: false };

    let settled = false;
    const finish = (extra) => {
      if (settled) return;
      settled = true;
      t.total = mark();
      if (extra) Object.assign(t, extra);
      resolve(t);
    };

    const timeoutTimer = setTimeout(() => {
      req && req.destroy();
      finish({ timeout: true, error: "TIMEOUT" });
    }, timeoutMs);

    // DNS
    const doRequest = (ip) => {
      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;
      const req = lib.request(
        {
          host: ip, // connect to resolved IP...
          servername: url.hostname, // ...but validate TLS SNI for the hostname
          path: url.pathname + url.search,
          method,
          headers: { Host: url.hostname, "User-Agent": "PrayerTimesApp-benchmark/1.0", ...headers },
          timeout: 0, // we handle our own timeout above
        },
        (res) => {
          t.ttfb = mark();
          t.status = res.statusCode;
          let bytes = 0;
          res.on("data", (c) => (bytes += c.length));
          res.on("end", () => {
            clearTimeout(timeoutTimer);
            finish({ bytes });
          });
          res.on("error", (e) => {
            clearTimeout(timeoutTimer);
            finish({ error: "READ_ERROR: " + e.message });
          });
          if (method === "HEAD" || res.statusCode >= 400) {
            // For HEAD or errors, drain minimal data
            res.resume();
          }
        }
      );
      req.on("error", (e) => {
        clearTimeout(timeoutTimer);
        finish({ error: "REQ_ERROR: " + e.message });
      });
      if (body) req.write(body);
      req.end();
      return req;
    };

    let req = null;
    dns.lookup(url.hostname, { family: 4 }, (err, address) => {
      if (err) {
        clearTimeout(timeoutTimer);
        finish({ error: "DNS_ERROR: " + err.code });
        return;
      }
      t.dns = mark();
      doRequest(address);
    });
  });
}

// For a precise TCP vs TLS split we do a separate probe with net/tls.
// Simpler approach: time the socket stages manually.
function timedFetchStages(rawUrl, { method = "GET", headers = {}, timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    const url = new URL(rawUrl);
    const isHttps = url.protocol === "https:";
    const t0 = Date.now();
    const t = { dns: null, tcp: null, tls: null, ttfb: null, total: null, status: null, bytes: null, error: null, timeout: false };

    let settled = false;
    const finish = (extra) => {
      if (settled) return;
      settled = true;
      t.total = Date.now() - t0;
      Object.assign(t, extra || {});
      resolve(t);
    };

    const timeoutTimer = setTimeout(() => {
      socket && socket.destroy();
      finish({ timeout: true, error: "TIMEOUT" });
    }, timeoutMs);

    let socket;
    dns.lookup(url.hostname, { family: 4 }, (err, address) => {
      if (err) {
        clearTimeout(timeoutTimer);
        finish({ error: "DNS_ERROR: " + err.code });
        return;
      }
      t.dns = Date.now() - t0;
      const startTcp = Date.now();
      if (isHttps) {
        socket = tls.connect(
          { host: address, servername: url.hostname, port: 443 },
          () => {
            const afterTls = Date.now();
            t.tcp = afterTls - startTcp; // approx (includes TLS for now)
            t.tls = afterTls - startTcp;
            sendRequest(socket);
          }
        );
      } else {
        socket = net.connect({ host: address, port: 80 }, () => {
          t.tcp = Date.now() - startTcp;
          t.tls = 0;
          sendRequest(socket);
        });
      }
      socket.on("error", (e) => {
        clearTimeout(timeoutTimer);
        finish({ error: "SOCKET_ERROR: " + e.message });
      });
    });

    function sendRequest(socket) {
      const reqPath = url.pathname + url.search;
      const req =
        `${method} ${reqPath} HTTP/1.1\r\n` +
        `Host: ${url.hostname}\r\n` +
        `User-Agent: PrayerTimesApp-benchmark/1.0\r\n` +
        `Connection: close\r\n` +
        `\r\n`;
      socket.write(req);
      let data = Buffer.alloc(0);
      socket.on("data", (c) => {
        if (t.ttfb === null) t.ttfb = Date.now() - t0;
        data = Buffer.concat([data, c]);
      });
      socket.on("end", () => {
        clearTimeout(timeoutTimer);
        const head = data.slice(0, data.indexOf("\r\n\r\n")).toString();
        const m = head.match(/HTTP\/[\d.]+ (\d+)/);
        t.status = m ? Number(m[1]) : null;
        const bodyStart = data.indexOf("\r\n\r\n");
        t.bytes = bodyStart >= 0 ? data.length - bodyStart - 4 : data.length;
        finish();
      });
    }
  });
}

function stats(arr) {
  const nums = arr.filter((v) => typeof v === "number");
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const median =
    sorted.length % 2 === 1 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { avg: +avg.toFixed(1), median: +median.toFixed(1), min: sorted[0], max: sorted[sorted.length - 1], n: nums.length };
}

async function benchSource(name, url, opts = {}, runs = RUNS) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    const r = await timedFetch(url, { ...opts, timeoutMs: 20000 });
    results.push(r);
    // small pause to avoid hammering servers
    await new Promise((res) => setTimeout(res, 300));
  }
  const timeouts = results.filter((r) => r.timeout).length;
  const errors = results.filter((r) => r.error && !r.timeout).length;
  const okCodes = results.filter((r) => r.status && r.status >= 200 && r.status < 300).length;
  const ttfb = stats(results.map((r) => r.ttfb));
  const total = stats(results.map((r) => r.total));
  const sizes = results.map((r) => r.bytes).filter(Boolean);
  const errDetail = [...new Set(results.filter((r) => r.error).map((r) => r.error))].join("; ") || "—";
  console.log(
    `${name}\n` +
      `  requests=${runs} ok=${okCodes} errors=${errors} timeouts=${timeouts} status=${[...new Set(results.map((r) => r.status).filter(Boolean))].join("/")}\n` +
      `  TTFB    avg=${ttfb ? ttfb.avg : "—"}ms median=${ttfb ? ttfb.median : "—"}ms min=${ttfb ? ttfb.min : "—"}ms max=${ttfb ? ttfb.max : "—"}ms\n` +
      `  TOTAL   avg=${total ? total.avg : "—"}ms median=${total ? total.median : "—"}ms min=${total ? total.min : "—"}ms max=${total ? total.max : "—"}ms\n` +
      `  bytes=${sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : "—"} err=${errDetail}`
  );
  return { name, results, timeouts, errors };
}

(async () => {
  console.log(`Runs per source: ${RUNS} (sequential, cold connection each time)\n`);

  console.log("=== QURAN AUDIO (the critical path) ===");
  // Alafasy ayah 2:75 -> global 82. Real playback URL used by the app.
  await benchSource("audio: cdn.islamic.network (Alafasy@64, ayah 2:75)", "https://cdn.islamic.network/quran/audio/64/ar.alafasy/82.mp3");
  await benchSource("audio: cdn.islamic.network (Husary@64, ayah 2:75)", "https://cdn.islamic.network/quran/audio/64/ar.husary/82.mp3");
  await benchSource("audio: cdn.islamic.network (Minshawi@128, ayah 2:75)", "https://cdn.islamic.network/quran/audio/128/ar.minshawi/82.mp3");
  await benchSource("audio: everyayah.com (fallback, Alafasy_128kbps 2:75)", "https://everyayah.com/data/Alafasy_128kbps/002075.mp3");
  await benchSource("audio: everyayah.com (fallback, Minshawy_Murattal 2:75)", "https://everyayah.com/data/Minshawy_Murattal_128kbps/002075.mp3");
  // Another ayah to be sure it's not a one-file fluke (1:1 = global 1).
  await benchSource("audio: cdn.islamic.network (Alafasy@64, ayah 1:1)", "https://cdn.islamic.network/quran/audio/64/ar.alafasy/1.mp3");
  await benchSource("audio: cdn.islamic.network (Alafasy@64, ayah 112:1)", "https://cdn.islamic.network/quran/audio/64/ar.alafasy/6226.mp3");

  console.log("\n=== QURAN TEXT ===");
  await benchSource("text: api.alquran.cloud surah list", "https://api.alquran.cloud/v1/surah");
  await benchSource("text: api.alquran.cloud surah 2 (uthmani+kuliev)", "https://api.alquran.cloud/v1/surah/2/editions/quran-uthmani,ru.kuliev", { runs: QUICK ? 2 : 4 });

  console.log("\n=== PRAYER TIMES ===");
  await benchSource("prayer: api.aladhan.com timings (Mecca)", "https://api.aladhan.com/v1/timings/11-09-2026?latitude=21.4225&longitude=39.8262&method=4", { runs: QUICK ? 2 : 4 });

  console.log("\n=== GEOCODING ===");
  await benchSource("geocoding: open-meteo (search Helsinki)", "https://geocoding-api.open-meteo.com/v1/search?name=helsinki&count=10&language=ru&format=json", { runs: QUICK ? 2 : 4 });

  console.log("\n=== MOSQUES (Overpass POST) ===");
  const overpassQuery =
    `[out:json][timeout:25];(node["amenity"="place_of_worship"]["religion"="muslim"](around:5000,60.1699,24.9384););out center tags;`;
  await benchSource(
    "mosques: overpass-api.de (POST Helsinki)",
    "https://overpass-api.de/api/interpreter",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "PrayerTimesApp/1.0 (Expo; contact: app@prayertimes.local)" },
      body: "data=" + encodeURIComponent(overpassQuery),
      timeoutMs: 30000,
    },
    QUICK ? 2 : 3
  );

  console.log("\n=== QIBLA (NOAA declination) ===");
  await benchSource("qibla: ngdc.noaa.gov declination (Helsinki)", "https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination?lat1=60.1699&lon1=24.9384&key=zNEw7&resultFormat=json", { runs: QUICK ? 2 : 4 });

  console.log("\nDone.");
})().catch((e) => {
  console.error("benchmark crashed:", e);
  process.exit(1);
});
