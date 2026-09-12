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

// ================= OUTPUT =================

console.log(results.join("\n"));
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
