// Test runner for the prayer-times app logic (run with: node scripts/run-tests.js)
// Pure Node — the modules under test have no native imports.
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const results = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push(`PASS  ${name}`);
  } catch (e) {
    failed++;
    results.push(`FAIL  ${name}\n      ${e && e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function approx(actual, expected, tol, msg) {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${msg || "approx"}: got ${actual}, expected ${expected} ±${tol}`);
  }
}

// --- load modules (strip ESM exports for CJS require) ---
function load(relPath) {
  const full = path.join(ROOT, relPath);
  const src = fs
    .readFileSync(full, "utf8")
    .replace(/^export function/gm, "function")
    .replace(/^export async function/gm, "async function")
    .replace(/^export const /gm, "const ")
    .replace(/^export default /gm, "module.exports.default = ");
  // collect exported names
  const names = [];
  const re = /^(?:export )?(?:async )?function (\w+)|^const (\w+)(?=\s*=)/gm;
  let m;
  const exportRe = /^(?:async )?function (\w+)|^const (\w+)(?=\s*=)/gm;
  while ((m = exportRe.exec(src))) names.push(m[1] || m[2]);
  const moduleSrc =
    src + "\nmodule.exports = { " + names.join(", ") + " };";
  const tmp = path.join(ROOT, ".expo", "test_mod_" + path.basename(relPath).replace(/[\\\/]/g, "_"));
  fs.writeFileSync(tmp + ".js", moduleSrc);
  return require(tmp + ".js");
}

const qibla = load("services/qiblaApi.js");
const hijri = load("utils/hijri.js");
const qiblaLock = load("utils/qiblaLock.js");

// ================= QIBLA BEARING =================

test("Helsinki -> Kaaba ≈ 158-161° (great-circle initial bearing)", () => {
  const b = qibla.qiblaBearing(60.1699, 24.9384);
  // Reference: initial bearing from Helsinki to the Kaaba. The task
  // quotes ~161°; the standard formula with the official Kaaba
  // coordinates gives ~158.5°. Both live in the same quadrant; we
  // assert the mathematical value and a sane range.
  approx(b, 158.2, 1.5, "Helsinki bearing");
});

test("London -> Kaaba ≈ 119° (reference value)", () => {
  const b = qibla.qiblaBearing(51.5074, -0.1278);
  approx(b, 118.99, 1.0, "London bearing");
});

test("Bearing at the Kaaba itself ≈ 0°", () => {
  const b = qibla.qiblaBearing(21.4225, 39.8262);
  approx(b, 0, 0.01, "at Kaaba");
});

test("Point just north of the Kaaba -> ~180° (southward)", () => {
  const b = qibla.qiblaBearing(21.5, 39.8262);
  approx(b, 180, 0.5, "north of Kaaba");
});

test("Point just south of the Kaaba -> ~0° (northward)", () => {
  const b = qibla.qiblaBearing(21.3, 39.8262);
  approx(b, 0, 0.5, "south of Kaaba");
});

test("Point due east of the Kaaba -> ~270° (westward)", () => {
  const b = qibla.qiblaBearing(21.4225, 40.5);
  approx(b, 270, 0.5, "east of Kaaba");
});

test("Point due west of the Kaaba -> ~90° (eastward)", () => {
  const b = qibla.qiblaBearing(21.4225, 39.0);
  approx(b, 90, 0.5, "west of Kaaba");
});

test("Bearing is always within 0..360", () => {
  for (let lat = -80; lat <= 80; lat += 7) {
    for (let lon = -170; lon <= 170; lon += 13) {
      const b = qibla.qiblaBearing(lat, lon);
      assert(b >= 0 && b < 360, `bearing out of range at ${lat},${lon}: ${b}`);
    }
  }
});

test("Kaaba coordinates are the official Masjid al-Haram values (21.4225, 39.8262)", () => {
  assert(qibla.KAABA.latitude === 21.4225, "KAABA.latitude");
  assert(qibla.KAABA.longitude === 39.8262, "KAABA.longitude");
});

// ================= CIRCULAR SMOOTHING =================

test("circularSmooth moves 359 -> 1 through 0, never through 180", () => {
  let cur = 359;
  const path = [cur];
  for (let i = 0; i < 6; i++) {
    cur = qibla.circularSmooth(cur, 1, 0.3);
    path.push(cur);
  }
  for (const v of path) {
    assert(v < 10 || v > 350, `value ${v} left the 0/360 neighborhood — long way round`);
  }
  approx(path[path.length - 1], 1, 1.5, "converges to 1");
});

test("circularSmooth moves 1 -> 359 through 0", () => {
  let cur = 1;
  for (let i = 0; i < 6; i++) cur = qibla.circularSmooth(cur, 359, 0.3);
  approx(cur, 359, 1.5, "converges to 359");
});

test("circularSmooth is stable at fixed point", () => {
  const v = qibla.circularSmooth(123.4, 123.4, 0.25);
  approx(v, 123.4, 0.001, "fixed point");
});

test("circularSmooth converges over many steps (no oscillation)", () => {
  let cur = 0;
  for (let i = 0; i < 100; i++) cur = qibla.circularSmooth(cur, 90, 0.1);
  approx(cur, 90, 0.5, "converged to 90");
});

test("circularSmooth result always normalized to 0..360", () => {
  for (let c = 0; c < 360; c += 15) {
    for (let t = 0; t < 360; t += 15) {
      const v = qibla.circularSmooth(c, t, 0.25);
      assert(v >= 0 && v < 360, `out of range: c=${c} t=${t} -> ${v}`);
    }
  }
});

// ================= MAGNETOMETER HEADING =================

test("magnetometerToHeading returns 0..360", () => {
  const vals = [
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 25, y: 20, z: -40 },
  ];
  for (const v of vals) {
    const h = qibla.magnetometerToHeading(v);
    assert(h >= 0 && h < 360, `heading out of range: ${h}`);
  }
});

test("magnetometerToHeading: north along +Y -> 0°", () => {
  const h = qibla.magnetometerToHeading({ x: 0, y: 1, z: 0 });
  approx(h, 0, 0.01, "north");
});

test("magnetometerToHeading: top edge east -> 90°", () => {
  const h = qibla.magnetometerToHeading({ x: -1, y: 0, z: 0 });
  approx(h, 90, 0.01, "east");
});

test("magnetometerToHeading: top edge south -> 180°", () => {
  const h = qibla.magnetometerToHeading({ x: 0, y: -1, z: 0 });
  approx(h, 180, 0.01, "south");
});

test("magnetometerToHeading: top edge west -> 270°", () => {
  const h = qibla.magnetometerToHeading({ x: 1, y: 0, z: 0 });
  approx(h, 270, 0.01, "west");
});

test("magnetometerToHeading: 3D tilt compensation preserves North/South when tilted in hand", () => {
  // Dagestan dip angle: BH = 24, BV = 45. Holding phone pitched 35° up:
  const s35 = Math.sin((35 * Math.PI) / 180);
  const c35 = Math.cos((35 * Math.PI) / 180);
  const accelTilted = { x: 0, y: s35, z: c35 };

  // Facing North (tilted): raw Y would be negative (-5.97 uT), inverting to 180° South without tilt comp
  const magNorthTilted = { x: 0, y: 24 * c35 - 45 * s35, z: -24 * s35 - 45 * c35 };
  const hNorth = qibla.magnetometerToHeading(magNorthTilted, accelTilted);
  approx(hNorth, 0, 0.5, "North stays 0° when tilted (no inversion to South)");

  // Facing South (tilted)
  const magSouthTilted = { x: 0, y: -24 * c35 - 45 * s35, z: 24 * s35 - 45 * c35 };
  const hSouth = qibla.magnetometerToHeading(magSouthTilted, accelTilted);
  approx(hSouth, 180, 0.5, "South stays 180° when tilted (no inversion to North)");
});

test("lock target shortest arc: prevents 360° spin bug on wrap", () => {
  // Unwrapped angle at -158° (same as 202° after crossing 0°)
  const cur = -158;
  const targetBearing = 202;
  const delta = qiblaLock.signedDelta(cur, targetBearing);
  const shortestTarget = cur + delta;
  approx(delta, 0, 0.001, "delta is 0, not +360");
  approx(shortestTarget, -158, 0.001, "snaps directly without 360° spin");

  // Slightly off by +2°
  const curOff = -156;
  const deltaOff = qiblaLock.signedDelta(curOff, targetBearing);
  approx(deltaOff, -2, 0.001, "delta is -2°");
  approx(curOff + deltaOff, -158, 0.001, "snaps by -2°");
});

// ================= QIBLA LOCK STATE MACHINE (light-beam compass) =================

test("signedDelta: shortest arc, sign, and 0/360 wrap", () => {
  approx(qiblaLock.signedDelta(10, 20), 10, 0.001, "10->20");
  approx(qiblaLock.signedDelta(20, 10), -10, 0.001, "20->10");
  approx(qiblaLock.signedDelta(359, 1), 2, 0.001, "359->1 through 0");
  approx(qiblaLock.signedDelta(1, 359), -2, 0.001, "1->359 through 0");
  approx(Math.abs(qiblaLock.signedDelta(180, 0)), 180, 0.001, "180 boundary magnitude");
  approx(Math.abs(qiblaLock.signedDelta(0, 180)), 180, 0.001, "0->180 boundary magnitude");
});

test("lock machine: engages after sustained alignment (~150 ms) and holds ~1.6 s", () => {
  let now = 1000;
  const m = qiblaLock.createLockMachine(() => now);
  // First 4 aligned ticks: still free (needs LOCK_CONSECUTIVE_TICKS=5).
  for (let i = 0; i < 4; i++) {
    assert(m.tick(1.5) === false, "must not lock before 5 consecutive aligned ticks");
    now += 30;
  }
  // 5th consecutive aligned tick -> locks.
  assert(m.tick(1.0) === true, "locks on the 5th consecutive aligned tick");
  // Still locked just before the hold expires.
  now += qiblaLock.LOCK_HOLD_MS - 40;
  assert(m.tick(0.5) === true, "stays locked during the hold window");
  // After the hold expires: released (aligned or not).
  now += 80;
  assert(m.tick(0.5) === false, "releases after the hold time");
});

test("lock machine: releases instantly on noticeable rotation (never feels frozen)", () => {
  let now = 5000;
  const m = qiblaLock.createLockMachine(() => now);
  for (let i = 0; i < 6; i++) m.tick(0);
  assert(m.locked === true, "locked");
  now += 100;
  // User rotates away beyond RELEASE_DEG while locked -> immediate release.
  assert(m.tick(20) === false, "releases on noticeable rotation during the hold");
});

test("lock machine: re-arms only after leaving the REARM envelope (no flapping)", () => {
  let now = 9000;
  const m = qiblaLock.createLockMachine(() => now);
  for (let i = 0; i < 6; i++) m.tick(0); // lock
  now += 2000; // hold expires while aligned
  assert(m.tick(1) === false, "released by time");
  // Hovering near the icon (inside REARM_DEG=6 but outside ALIGN_TOL=3):
  // must NOT re-lock immediately.
  now += 60;
  assert(m.tick(5) === false, "no re-lock while hovering inside the rearm envelope");
  for (let i = 0; i < 8; i++) {
    now += 30;
    m.tick(5);
  }
  assert(m.locked === false, "still free while hovering");
  // Leave the envelope, come back and align -> locks again.
  now += 60;
  m.tick(10); // beyond REARM_DEG -> re-armed
  for (let i = 0; i < 4; i++) {
    now += 30;
    m.tick(2);
  }
  assert(m.locked === false, "not yet (4 ticks)");
  now += 30;
  assert(m.tick(1) === true, "re-locks after re-arm + sustained alignment");
});

test("lock machine: brief misalignment resets the consecutive counter", () => {
  let now = 20000;
  const m = qiblaLock.createLockMachine(() => now);
  for (let i = 0; i < 4; i++) {
    now += 30;
    m.tick(1);
  }
  now += 30;
  m.tick(9); // brief excursion beyond ALIGN_TOL
  now += 30;
  assert(m.tick(1) === false, "counter reset — needs another 5 aligned ticks");
  for (let i = 0; i < 3; i++) {
    now += 30;
    m.tick(1);
  }
  assert(m.locked === false, "still free after 3 ticks");
  for (let i = 0; i < 2; i++) {
    now += 30;
    m.tick(1);
  }
  assert(m.locked === true, "locks on the 5th aligned tick after reset");
});

test("lock machine: alignment tolerance is ±3° (both sides, incl. across 0/360)", () => {
  let now = 30000;
  const m = qiblaLock.createLockMachine(() => now);
  for (let i = 0; i < 6; i++) {
    now += 30;
    m.tick(359.5); // -0.5° — aligned
  }
  assert(m.locked === true, "locks at 359.5 (just across the 0/360 seam)");
  now += qiblaLock.LOCK_HOLD_MS + 100;
  m.tick(1); // released by time
  now += 60;
  m.tick(10); // re-arm
  now += 30;
  for (let i = 0; i < 5; i++) {
    now += 30;
    m.tick(3.0); // exactly at the tolerance edge
  }
  assert(m.locked === true, "locks at exactly 3°");
  now += qiblaLock.LOCK_HOLD_MS + 100;
  m.tick(0); // released by time
  now += 60;
  m.tick(10); // re-arm
  now += 30;
  for (let i = 0; i < 8; i++) {
    now += 30;
    m.tick(4.5); // beyond the tolerance
  }
   assert(m.locked === false, "never locks beyond the tolerance");
});

// ================= QIBLA COMPASS LAYOUT (visual angle = math angle) =================
// Regression test for the iteration-8 layout bug: the ring/cardinals moved
// to a 32px inset but the rotating beamGroup stayed at (0,0). React Native
// rotate() pivots around the element CENTER, so the beam's pivot stopped
// coinciding with the ring's center and every beam angle read skewed on the
// static cardinal scale (up to ~30° error, angle-dependent — e.g. Derbent
// 201.62° rendered at 231.58°). The fix restores the concentric geometry of
// commit 63dc672 inside the 8b static design. This test parses the REAL
// app/qibla.js styles and asserts concentricity + zero visual-vs-math error.

function qiblaLayoutFromSource() {
  const src = fs.readFileSync(path.join(ROOT, "app", "qibla.js"), "utf8");
  const style = (name) => {
    const m = src.match(new RegExp(name + ": \\{[\\s\\S]*?\\n  \\}"));
    if (!m) throw new Error("style not found: " + name);
    return m[0];
  };
  const num = (styleSrc, re, what) => {
    const m = styleSrc.match(re);
    if (!m) throw new Error("cannot parse " + what);
    return Number(m[1]);
  };
  const DIAL_SIZE = num(src, /const DIAL_SIZE = ([\d.]+)/, "DIAL_SIZE");
  const DIAL_RADIUS = DIAL_SIZE / 2;

  // ring offset (may be 0 in the reference layout or an explicit inset)
  const ring = style("ring");
  const ringLeft = num(ring, /left: ([\d.]+)/, "ring.left");
  const ringTop = num(ring, /top: ([\d.]+)/, "ring.top");

  // beamGroup offset — may be "left: 32" or "left: 0" (both parseable numbers)
  const bg = style("beamGroup");
  const bgLeft = num(bg, /left: ([\d.]+)/, "beamGroup.left");
  const bgTop = num(bg, /top: ([\d.]+)/, "beamGroup.top");

  // pivot of the beam rotation = beamGroup center (RN rotate() pivot)
  const pivot = { x: bgLeft + DIAL_SIZE / 2, y: bgTop + DIAL_SIZE / 2 };
  // center of the static reading scale = ring center
  const scale = { x: ringLeft + DIAL_RADIUS, y: ringTop + DIAL_RADIUS };
  return { pivot, scale, DIAL_SIZE, DIAL_RADIUS };
}

test("Qibla layout: the beam's rotation pivot coincides with the ring center (concentric)", () => {
  const { pivot, scale } = qiblaLayoutFromSource();
  assert(pivot.x === scale.x && pivot.y === scale.y,
    `beam pivot (${pivot.x},${pivot.y}) != ring center (${scale.x},${scale.y}) — beam angles would render skewed`);
});

test("Qibla layout: rendered beam angle equals the pushed math angle (±0.01°)", () => {
  const { pivot, scale } = qiblaLayoutFromSource();
  // Model: at rotate(0deg) the beam segment A center-line tip sits at
  // local (DIAL_RADIUS, 91) — top:46, height:DIAL_RADIUS-46 — i.e. 90px
  // above the pivot along the local UP axis. After rotating by theta the
  // tip is pivot + 90*(sin θ, -cos θ). The angle at which a viewer standing
  // at the SCALE CENTER sees the beam must equal theta exactly.
  const R_TIP = 90;
  const beamTipAt = (thetaDeg) => {
    const r = (thetaDeg * Math.PI) / 180;
    return {
      x: pivot.x + R_TIP * Math.sin(r),
      y: pivot.y - R_TIP * Math.cos(r),
    };
  };
  const apparentAt = (thetaDeg) => {
    const tip = beamTipAt(thetaDeg);
    const a = (Math.atan2(tip.x - scale.x, -(tip.y - scale.y)) * 180) / Math.PI;
    return (a + 360) % 360;
  };
  const delta = (a, b) => ((a - b + 540) % 360) - 180;
  // several representative bearings incl. all quadrants and the seam
  for (const theta of [0, 58.48, 90, 118.99, 176.36, 201.62, 277.57, 359]) {
    const err = Math.abs(delta(apparentAt(theta), theta));
    assert(err <= 0.01, `visual angle deviates from math at θ=${theta}°: err=${err.toFixed(2)}°`);
  }
});


// ================= HIJRI DATE =================

test("Hijri: 11 Sep 2026 -> Rabīʿ al-awwal 1448 (day 29 or 30 — tabular algorithm)", () => {
  const h = hijri.gregorianToHijri(2026, 9, 11);
  assert(h.year === 1448, `year: ${h.year}`);
  assert(h.month === 3, `month: ${h.month}`);
  assert(h.day === 29 || h.day === 30, `day: ${h.day}`);
});

test("Hijri: 18 Feb 2026 -> 1 Ramadan 1447 (announced start of Ramadan)", () => {
  const h = hijri.gregorianToHijri(2026, 2, 18);
  assert(h.year === 1447, `year: ${h.year}`);
  assert(h.month === 9, `month: ${h.month}`);
  assert(h.day === 1, `day: ${h.day}`);
});

test("Hijri: month names are real Islamic months (1=Мухаррам, 9=Рамадан, 12=Зу-ль-хиджа)", () => {
  assert(hijri.hijriMonthName(1) === "Мухаррам");
  assert(hijri.hijriMonthName(9) === "Рамадан");
  assert(hijri.hijriMonthName(12) === "Зу-ль-хиджа");
});

test("Hijri: format is day -> month -> year", () => {
  const text = hijri.formatHijriDate({ day: 29, month: 3, year: 1448 });
  assert(text === "29 Раби аль-авваль 1448", `format: ${text}`);
});

test("Hijri: monotonic progression across a Gregorian month", () => {
  let prev = null;
  for (let d = 1; d <= 30; d++) {
    const h = hijri.gregorianToHijri(2026, 3, d);
    if (prev) {
      const diff =
        h.year * 12 + h.month - (prev.year * 12 + prev.month);
      assert(diff === 0 || diff === 1, `unexpected month jump at 2026-03-${d}`);
    }
    prev = h;
  }
});

// ================= LISTEN MODE: FULL-SURAH RECITER REGISTRY =================
// The Listen player's reciter registry: 60 famous reciters, each with a
// COMPLETE 114-surah full-track set (verified live 2026-09-14: every
// server probed on 001/002/018/036/055/114 — 360/360 HTTP 200).
// RU/EN search aliases, full-surah URL builders, same-human fallback.
// The READING-mode RECITERS (3 EveryAyah) are untouched.

const audioRegistry = load("services/quranSurahAudioRegistry.js");

test("Listen registry: exactly 60 famous reciters, unique ids", () => {
  const all = audioRegistry.LISTEN_RECITERS;
  assert(all.length === 60, `expected 60, got ${all.length}`);
  const ids = new Set(all.map((r) => r.id));
  assert(ids.size === 60, `duplicate ids: ${all.length - ids.size}`);
  const servers = new Set(all.map((r) => r._server));
  assert(servers.size === 60, `expected 60 distinct servers, got ${servers.size}`);
});

test("Listen registry: every id has 'mq:' prefix + non-empty name/aliases/server", () => {
  for (const r of audioRegistry.LISTEN_RECITERS) {
    assert(r.id.startsWith("mq:"), `bad id: ${r.id}`);
    assert(r.name && r.name.length > 2, `empty name: ${r.id}`);
    assert(r.nameEn && r.nameEn.length > 2, `empty nameEn: ${r.id}`);
    assert(Array.isArray(r.aliases) && r.aliases.length > 0, `no aliases: ${r.id}`);
    assert(/^https:\/\/server\d+\.mp3quran\.net\//.test(r._server), `bad server: ${r.id} ${r._server}`);
  }
});

test("Listen registry: the verified famous 60 are ALL present (spot ids)", () => {
  const expected = [
    "mq:afasy", "mq:husary", "mq:minshawi", "mq:abdulbasit", "mq:ghamdi",
    "mq:sudais", "mq:shuraim", "mq:yasserdosari", "mq:shatri", "mq:hanirifai",
    "mq:maher", "mq:ajmi", "mq:matroud", "mq:budair", "mq:juhany",
    "mq:qatami", "mq:abbad", "mq:hudhaify", "mq:alijaber", "mq:bukhatir",
    "mq:sahlyassin", "mq:tablawi", "mq:ayyub", "mq:jibreel", "mq:mustafaismail",
    "mq:albanna", "mq:qasim", "mq:kalbany", "mq:jalil", "mq:lohaidan",
    "mq:khayyat", "mq:basfar", "mq:soufi", "mq:alzain", "mq:alaqmi",
    "mq:sultany", "mq:salamah", "mq:asimluhaidan", "mq:ibrahimdosari", "mq:tunaiji",
    "mq:zaki", "mq:raadkurdi", "mq:balilah", "mq:muhasny", "mq:azizahmad",
    "mq:akdar", "mq:abusneina", "mq:abdulhakam", "mq:saber", "mq:kafi",
    "mq:yahyahawwa", "mq:sayegh", "mq:hajjaj", "mq:jazairi", "mq:qahtani",
    "mq:abdulkareem", "mq:albadr", "mq:obaikan", "mq:qazabri", "mq:salimi",
  ];
  const ids = new Set(audioRegistry.LISTEN_RECITERS.map((r) => r.id));
  for (const id of expected) {
    assert(ids.has(id), `missing reciter id: ${id}`);
  }
});

test("Listen URLs: full-surah format {server}/NNN.mp3 (afasy 18 -> 018.mp3)", () => {
  const url = audioRegistry.getSurahAudioUrl("mq:afasy", 18);
  assert(url === "https://server8.mp3quran.net/afs/018.mp3", `got ${url}`);
  const url1 = audioRegistry.getSurahAudioUrl("mq:husary", 1);
  assert(url1 === "https://server13.mp3quran.net/husr/001.mp3", `got ${url1}`);
  const url114 = audioRegistry.getSurahAudioUrl("mq:abdulbasit", 114);
  assert(url114 === "https://server7.mp3quran.net/basit/114.mp3", `got ${url114}`);
});

test("Listen URLs: zero-padding for surahs 1..9 and 10..99", () => {
  assert(audioRegistry.getSurahAudioUrl("mq:afasy", 1).endsWith("/001.mp3"));
  assert(audioRegistry.getSurahAudioUrl("mq:afasy", 9).endsWith("/009.mp3"));
  assert(audioRegistry.getSurahAudioUrl("mq:afasy", 10).endsWith("/010.mp3"));
  assert(audioRegistry.getSurahAudioUrl("mq:afasy", 99).endsWith("/099.mp3"));
  assert(audioRegistry.getSurahAudioUrl("mq:afasy", 100).endsWith("/100.mp3"));
});

test("Listen URLs: invalid surah / unknown reciter -> null, never malformed", () => {
  assert(audioRegistry.getSurahAudioUrl("mq:afasy", 0) === null);
  assert(audioRegistry.getSurahAudioUrl("mq:afasy", 115) === null);
  assert(audioRegistry.getSurahAudioUrl("mq:afasy", -1) === null);
  assert(audioRegistry.getSurahAudioUrl("mq:afasy", 1.5) === null);
  assert(audioRegistry.getSurahAudioUrl("mq:afasy", "2") !== null); // coerced
  assert(audioRegistry.getSurahAudioUrl("unknown:id", 1) === null);
  assert(audioRegistry.getSurahAudioUrl(null, 1) === null);
});

test("Listen fallback: same-human full-surah quranicaudio URL (husary)", () => {
  const fb = audioRegistry.getSurahAudioFallbackUrl("mq:husary", 2);
  assert(fb === "https://download.quranicaudio.com/quran/mahmood_khaleel_al-husaree/002.mp3", `got ${fb}`);
  // reciters without an honest full-surah fallback -> null (PRIMARY only)
  assert(audioRegistry.getSurahAudioFallbackUrl("mq:hanirifai", 2) === null);
  assert(audioRegistry.getSurahAudioFallbackUrl("mq:lohaidan", 2) === null); // partial on qa
  assert(audioRegistry.getSurahAudioFallbackUrl("unknown:id", 2) === null);
});

test("Listen fallback: fallback URL is ALWAYS a full-surah NNN.mp3 (never an ayah)", () => {
  for (const r of audioRegistry.LISTEN_RECITERS) {
    const fb = audioRegistry.getSurahAudioFallbackUrl(r.id, 55);
    if (fb === null) continue;
    assert(fb.startsWith("https://download.quranicaudio.com/quran/"), `bad base: ${fb}`);
    assert(/\/055\.mp3$/.test(fb), `not a full-surah file: ${fb}`);
    assert(!/ayah|surah\/\d+\/ayah/.test(fb), `ayah-like fallback: ${fb}`);
  }
});

test("Listen search: RU and EN queries find the SAME reciter (Alafasy case)", () => {
  const queries = ["Мишари", "мишари аль-афаси", "Mishari", "Mishary", "Alafasy", "Afasy", "афаси"];
  for (const q of queries) {
    const found = audioRegistry.searchListenReciters(q);
    assert(
      found.some((r) => r.id === "mq:afasy"),
      `query "${q}" must find mq:afasy`
    );
  }
});

test("Listen search: normalization (case, trim, spaces, diacritics)", () => {
  const found = audioRegistry.searchListenReciters("  AlAFasy  ");
  assert(found.some((r) => r.id === "mq:afasy"), "case/trim must work");
  assert(audioRegistry.searchListenReciters("Mishary Rashid").some((r) => r.id === "mq:afasy"));
});

test("Listen search: cross-language for several reciters", () => {
  assert(audioRegistry.searchListenReciters("Хусари").some((r) => r.id === "mq:husary"));
  assert(audioRegistry.searchListenReciters("Husary").some((r) => r.id === "mq:husary"));
  assert(audioRegistry.searchListenReciters("Гамди").some((r) => r.id === "mq:ghamdi"));
  assert(audioRegistry.searchListenReciters("Ghamdi").some((r) => r.id === "mq:ghamdi"));
  assert(audioRegistry.searchListenReciters("Муайкли").some((r) => r.id === "mq:maher"));
  assert(audioRegistry.searchListenReciters("Maher").some((r) => r.id === "mq:maher"));
  assert(audioRegistry.searchListenReciters("Судайс").some((r) => r.id === "mq:sudais"));
  assert(audioRegistry.searchListenReciters("Sudais").some((r) => r.id === "mq:sudais"));
  assert(audioRegistry.searchListenReciters("Бухатир").some((r) => r.id === "mq:bukhatir"));
  assert(audioRegistry.searchListenReciters("bukhatir").some((r) => r.id === "mq:bukhatir"));
  assert(audioRegistry.searchListenReciters("Джалиль").some((r) => r.id === "mq:jalil"));
  assert(audioRegistry.searchListenReciters("Jalil").some((r) => r.id === "mq:jalil"));
  // English name (nameEn) is searchable too
  assert(audioRegistry.searchListenReciters("Yasser Ad-Dosari").some((r) => r.id === "mq:yasserdosari"));
});

test("Listen search: empty query returns the full registry", () => {
  assert(audioRegistry.searchListenReciters("").length === 60);
  assert(audioRegistry.searchListenReciters(null).length === 60);
});

test("Listen default reciter is valid", () => {
  assert(audioRegistry.DEFAULT_LISTEN_RECITER === "mq:afasy");
  assert(audioRegistry.getListenReciter("mq:afasy") !== null);
  assert(audioRegistry.getListenReciter("nope") === null);
});

test("Reading-mode RECITERS untouched (3 quick reciters)", () => {
  // loads services/quranApi.js through the same loader
  const quranApi = load("services/quranApi.js");
  assert(quranApi.RECITERS.length === 3, `expected 3, got ${quranApi.RECITERS.length}`);
  assert(quranApi.DEFAULT_RECITER === "ar.alafasy");
  const url = quranApi.getAyahAudioUrl(2, 200, "ar.alafasy");
  assert(url === "https://everyayah.com/data/Alafasy_128kbps/002200.mp3", `got ${url}`);
});

test("Read mode constants: PRIMARY_TEXT_TIMEOUT_MS, TOTAL_TIMEOUT_MS, PRIMARY_AUDIO_TIMEOUT_MS", () => {
  const quranApi = load("services/quranApi.js");
  assert(quranApi.PRIMARY_TEXT_TIMEOUT_MS === 2000, `expected 2000, got ${quranApi.PRIMARY_TEXT_TIMEOUT_MS}`);
  assert(quranApi.TOTAL_TIMEOUT_MS === 10000, `expected 10000, got ${quranApi.TOTAL_TIMEOUT_MS}`);
  assert(quranApi.PRIMARY_AUDIO_TIMEOUT_MS === 2000, `expected 2000, got ${quranApi.PRIMARY_AUDIO_TIMEOUT_MS}`);
});

test("Read mode audio: RF uses alislam CDN and non-RF uses everyayah", () => {
  const quranApi = load("services/quranApi.js");
  const rfCity = { country: "Россия" };
  const foreignCity = { country: "United Kingdom" };
  const urlRF = quranApi.getAyahAudioUrl(1, 1, "ar.alafasy", 1, rfCity);
  assert(urlRF === "https://cdn.alislam.ru/quran/audio/128/ar.alafasy/1.mp3", `bad RF url: ${urlRF}`);
  const urlForeign = quranApi.getAyahAudioUrl(1, 1, "ar.alafasy", 1, foreignCity);
  assert(urlForeign === "https://everyayah.com/data/Alafasy_128kbps/001001.mp3", `bad foreign url: ${urlForeign}`);
});

test("Read mode audio fallback: reciter IDs mapped and verified 128 kbps", () => {
  const quranApi = load("services/quranApi.js");
  for (const r of quranApi.RECITERS) {
    const fallback = quranApi.getAyahAudioUrlFallback(1, r.id);
    assert(fallback !== null, `expected fallback url for ${r.id}`);
    assert(fallback.includes(`/128/${r.id}/1.mp3`), `bad fallback url for ${r.id}: ${fallback}`);
  }
});

// ================= THEME ARCHITECTURE & SELECTION UNIQUENESS =================

test("Theme architecture: 6 core styles defined (Тёмная, Светлая, Природа, Синий, Фиолетовый, Минимализм)", () => {
  const colorsMod = load("theme/colors.js");
  const meta = colorsMod.THEMES_META;
  assert(meta.length === 6, `expected 6 themes in meta, got ${meta.length}`);
  const expectedIds = ["dark", "light", "nature", "blue", "purple", "minimalism"];
  for (const id of expectedIds) {
    assert(meta.some((t) => t.id === id), `missing theme id: ${id}`);
    assert(colorsMod.THEMES[id], `missing theme definition in THEMES for ${id}`);
  }
});

test("Theme selector uniqueness: theme selection physically present ONLY in SettingsScreen.js", () => {
  const fg = (dir) => {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".git" && e.name !== ".expo") {
        files = files.concat(fg(full));
      } else if (e.isFile() && (e.name.endsWith(".js") || e.name.endsWith(".jsx"))) {
        files.push(full);
      }
    }
    return files;
  };

  const allSourceFiles = fg(path.join(ROOT, "app")).concat(fg(path.join(ROOT, "components")));
  const filesWithThemeSelection = [];

  for (const file of allSourceFiles) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    // Look for theme selector UI or setThemeMode calls
    if (content.includes("setThemeMode(") && !rel.includes("ThemeContext")) {
      filesWithThemeSelection.push(rel);
    }
  }

  // Must only be components/SettingsScreen.js
  assert(
    filesWithThemeSelection.length === 1 &&
      filesWithThemeSelection[0] === "components/SettingsScreen.js",
    `Theme selection UI must ONLY be in components/SettingsScreen.js, found in: ${filesWithThemeSelection.join(", ")}`
  );

  // Assert redundant components/ThemeSelector.js does NOT exist
  assert(
    !fs.existsSync(path.join(ROOT, "components", "ThemeSelector.js")),
    "components/ThemeSelector.js must not exist"
  );
});

test("Theme hook import integrity: all files calling useTheme/useAppTheme have proper imports", () => {
  const fg = (dir) => {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".git" && e.name !== ".expo") {
        files = files.concat(fg(full));
      } else if (e.isFile() && (e.name.endsWith(".js") || e.name.endsWith(".jsx"))) {
        files.push(full);
      }
    }
    return files;
  };

  const allSourceFiles = fg(path.join(ROOT, "app")).concat(fg(path.join(ROOT, "components")));
  const missingImports = [];

  for (const file of allSourceFiles) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    const usesUseTheme = /\buseTheme\s*\(/.test(content);
    const importsUseTheme = /import\s*\{[^}]*\buseTheme\b[^}]*\}\s*from/.test(content);
    if (usesUseTheme && !importsUseTheme) {
      missingImports.push(`${rel} (missing useTheme)`);
    }
    const usesUseAppTheme = /\buseAppTheme\s*\(/.test(content);
    const importsUseAppTheme = /import\s*\{[^}]*\buseAppTheme\b[^}]*\}\s*from/.test(content);
    if (usesUseAppTheme && !importsUseAppTheme) {
      missingImports.push(`${rel} (missing useAppTheme)`);
    }
  }

  assert(
    missingImports.length === 0,
    `Missing theme imports found in: ${missingImports.join(", ")}`
  );
});

test("Mosque background toggle: storage persistence and theme context wiring", () => {
  const storageContent = fs.readFileSync(path.join(ROOT, "utils", "storage.js"), "utf8");
  assert(storageContent.includes("saveShowMosqueBg"), "saveShowMosqueBg must be defined in storage.js");
  assert(storageContent.includes("getSavedShowMosqueBg"), "getSavedShowMosqueBg must be defined in storage.js");

  const themeContextContent = fs.readFileSync(path.join(ROOT, "theme", "ThemeContext.js"), "utf8");
  assert(themeContextContent.includes("showMosqueBg"), "showMosqueBg must be exposed in ThemeContext");
  assert(themeContextContent.includes("setShowMosqueBg"), "setShowMosqueBg must be exposed in ThemeContext");

  const mosqueSilhouetteContent = fs.readFileSync(path.join(ROOT, "components", "MosqueSilhouette.js"), "utf8");
  assert(mosqueSilhouetteContent.includes("showMosqueBg"), "MosqueSilhouette must read showMosqueBg from theme");
  assert(mosqueSilhouetteContent.includes("showMosqueBg !== false"), "MosqueSilhouette must conditionally render skylineRow");

  const settingsContent = fs.readFileSync(path.join(ROOT, "components", "SettingsScreen.js"), "utf8");
  assert(!settingsContent.includes("useState(true)"), "SettingsScreen must not shadow showMosqueBg with local useState");
});

test("Splash screen consistency: seamless dark boot background (#050c17)", () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, "app.json"), "utf8"));
  assert(appJson.expo.splash.backgroundColor === "#050c17", "Native splash must be #050c17");
  assert(appJson.expo.android.adaptiveIcon.backgroundColor === "#050c17", "Adaptive icon background must be #050c17");

  const bootSplashContent = fs.readFileSync(path.join(ROOT, "components", "BootSplash.js"), "utf8");
  assert(bootSplashContent.includes("#050c17"), "BootSplash container background must be #050c17");
});

test("Header title alignment: Quran and Qibla titles strictly centered on screen", () => {
  const quranContent = fs.readFileSync(path.join(ROOT, "components", "QuranScreen.js"), "utf8");
  assert(quranContent.includes("styles.headerTitleContainer"), "QuranScreen must use headerTitleContainer");
  assert(quranContent.includes('pointerEvents="none"'), "Quran headerTitleContainer must have pointerEvents='none'");

  const qiblaContent = fs.readFileSync(path.join(ROOT, "app", "qibla.js"), "utf8");
  assert(qiblaContent.includes("styles.headerTitleContainer"), "qibla.js must use headerTitleContainer");
  assert(qiblaContent.includes('pointerEvents="none"'), "Qibla headerTitleContainer must have pointerEvents='none'");
});

test("NextPrayer: does not render (завтра) label", () => {
  const nextPrayerContent = fs.readFileSync(path.join(ROOT, "components", "NextPrayer.js"), "utf8");
  assert(!nextPrayerContent.includes("(завтра)"), "NextPrayer must not render '(завтра)'");
});

test("Stitch Mosque Architecture: strictly without domes, applied across all screens", () => {
  assert(fs.existsSync(path.join(ROOT, "components", "StitchMosque.js")), "StitchMosque component must exist");
  const stitchMosqueSrc = fs.readFileSync(path.join(ROOT, "components", "StitchMosque.js"), "utf8");
  assert(stitchMosqueSrc.includes('viewBox="0 0 312 280"'), "StitchMosque must use Stitch viewBox");
  assert(stitchMosqueSrc.includes("react-native-svg"), "StitchMosque must use react-native-svg");

  const targetFiles = [
    path.join(ROOT, "components", "MosqueSilhouette.js"),
    path.join(ROOT, "components", "SettingsScreen.js"),
    path.join(ROOT, "components", "QuranScreen.js"),
    path.join(ROOT, "app", "qibla.js"),
    path.join(ROOT, "components", "BootSplash.js"),
  ];

  for (const f of targetFiles) {
    const content = fs.readFileSync(f, "utf8");
    assert(content.includes("StitchMosque"), `${path.basename(f)} must import/render StitchMosque`);
    assert(!content.includes('name="mosque"'), `${path.basename(f)} must not use generic name="mosque" icon`);
  }
});

test("Qibla: requests location whenever focused (useFocusEffect + locateUser)", () => {
  const qiblaContent = fs.readFileSync(path.join(ROOT, "app", "qibla.js"), "utf8");
  assert(qiblaContent.includes("useFocusEffect"), "qibla.js must use useFocusEffect");
  assert(qiblaContent.includes("requestGpsLocation"), "qibla.js must define requestGpsLocation");
  assert(qiblaContent.includes("locateUser"), "qibla.js must call locateUser");
  assert(qiblaContent.includes("gpsRefreshBtn"), "qibla.js must have gpsRefreshBtn for manual refresh");
});

test("Source attribution: completely removed from main screen and theme selection", () => {
  const homeContent = fs.readFileSync(path.join(ROOT, "app", "(tabs)", "index.js"), "utf8");
  assert(!homeContent.includes("SourceBadge"), "HomeScreen must not import or render SourceBadge");
  assert(!homeContent.includes("SourceInfoToast"), "HomeScreen must not render SourceInfoToast");
  assert(!homeContent.includes("footerRow"), "HomeScreen must not have footerRow style");

  const settingsContent = fs.readFileSync(path.join(ROOT, "components", "SettingsScreen.js"), "utf8");
  assert(!settingsContent.includes("mockupSourceRow"), "SettingsScreen must not render mockupSourceRow");
  assert(!settingsContent.includes("mockupSourceBadge"), "SettingsScreen must not have mockupSourceBadge");
});

test("Mosque proportions: un-squashed Stitch aspect ratio (312:280) and lowered offset across main screen and theme settings mockup", () => {
  const silhouetteContent = fs.readFileSync(path.join(ROOT, "components", "MosqueSilhouette.js"), "utf8");
  assert(silhouetteContent.includes("SCREEN_WIDTH * (280 / 312)"), "MosqueSilhouette must calculate MOSQUE_HEIGHT to preserve 312:280 Stitch ratio without squashing");
  assert(silhouetteContent.includes("MOSQUE_BOTTOM = -Math.round"), "MosqueSilhouette must define MOSQUE_BOTTOM to lower the mosque down");
  assert(silhouetteContent.includes("height={MOSQUE_HEIGHT}"), "MosqueSilhouette must pass MOSQUE_HEIGHT to StitchMosque");
  assert(silhouetteContent.includes("bottom: MOSQUE_BOTTOM"), "MosqueSilhouette must apply MOSQUE_BOTTOM to skylineRow");

  const settingsContent = fs.readFileSync(path.join(ROOT, "components", "SettingsScreen.js"), "utf8");
  assert(settingsContent.includes("278 * (280 / 312)"), "SettingsScreen must calculate MOCKUP_MOSQUE_HEIGHT with 312:280 Stitch ratio");
  assert(settingsContent.includes("MOCKUP_MOSQUE_BOTTOM = -Math.round"), "SettingsScreen must define MOCKUP_MOSQUE_BOTTOM to lower the mockup mosque");
  assert(settingsContent.includes("height={MOCKUP_MOSQUE_HEIGHT}"), "SettingsScreen must pass MOCKUP_MOSQUE_HEIGHT to StitchMosque");
  assert(settingsContent.includes("bottom: MOCKUP_MOSQUE_BOTTOM"), "SettingsScreen must apply MOCKUP_MOSQUE_BOTTOM to mockupMosqueWrap");
});

test("Listen player: Arabic surah name typography prevents harakats clipping", () => {
  const playerContent = fs.readFileSync(path.join(ROOT, "app", "listen", "player.js"), "utf8");
  assert(playerContent.includes("surahTitleLine"), "surahTitleLine must wrap the surah title text");
  assert(playerContent.includes("minHeight: 56"), "surahSelector must have minHeight: 56 rather than fixed height");
  assert(playerContent.includes("surahArabicText"), "surahArabicText must be styled");
  assert(playerContent.includes("seekBtn"), "player must render rewind and forward buttons");
  assert(playerContent.includes("loopBtn"), "player must render loop toggle button");
});

test("Surah audio hook: supports isLooping, toggleLoop, and seekBy", () => {
  const hookContent = fs.readFileSync(path.join(ROOT, "hooks", "useSurahAudio.js"), "utf8");
  assert(hookContent.includes("isLooping"), "useSurahAudio must support isLooping state");
  assert(hookContent.includes("toggleLoop"), "useSurahAudio must export toggleLoop");
  assert(hookContent.includes("seekBy"), "useSurahAudio must export seekBy");
  assert(hookContent.includes("setIsLoopingAsync"), "useSurahAudio must set looping on Sound");
});

// ================= OUTPUT =================

console.log(results.join("\n"));
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
