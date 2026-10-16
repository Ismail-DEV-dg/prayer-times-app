// Qibla direction from the user's CURRENT GPS location.
//
// The Kaaba coordinates are the internationally used values of the
// Masjid al-Haram. Bearing uses the great-circle initial bearing
// formula. For the on-screen compass we also need the local magnetic
// declination to convert true north -> magnetic north; we try NOAA's
// geomagnetic calculator and silently fall back to null when
// unavailable — with an explicit flag telling the UI about it.

// Pure math — no native imports, safe for unit tests.

// Kaaba (Masjid al-Haram), Makkah: 21.4225 N, 39.8262 E.
export const KAABA = { latitude: 21.4225, longitude: 39.8262 };

const toRad = (v) => (v * Math.PI) / 180;
const toDeg = (v) => (v * 180) / Math.PI;

// Great-circle initial bearing from (lat1, lon1) to (lat2, lon2), degrees 0..360.
// Standard formula:
//   X = sin(dLambda) * cos(phi2)
//   Y = cos(phi1) * sin(phi2) - sin(phi1) * cos(phi2) * cos(dLambda)
//   bearing = atan2(X, Y)
export function qiblaBearing(latitude, longitude) {
  const phi1 = toRad(latitude);
  const phi2 = toRad(KAABA.latitude);
  const dLambda = toRad(KAABA.longitude - longitude);

  const x = Math.sin(dLambda) * Math.cos(phi2);
  const y = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const bearing = (toDeg(Math.atan2(x, y)) + 360) % 360;
  return bearing;
}

// Magnetic declination via NOAA (verified working, JSON).
// Returns degrees (east positive) or null when unavailable.
export async function fetchMagneticDeclination(latitude, longitude) {
  const url =
    `https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination` +
    `?lat1=${latitude}&lon1=${longitude}&key=zNEw7&resultFormat=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const json = await response.json();
    const value = json && json.result && json.result[0] && json.result[0].declination;
    return isFinite(value) ? Number(value) : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Converts a raw magnetometer reading {x,y,z} (device flat, screen up)
// to a COMPASS heading in degrees: 0 = magnetic north, 90 = east.
// Android device axes: X -> right edge, Y -> top edge, Z -> out of
// the screen. With the top edge pointing north the field projects
// onto +Y => (x, y) = (0, +B); with the top edge pointing east the
// field is along -X => (x, y) = (-B, 0). The heading solving all
// cardinal cases is atan2(-x, y):
//   top north  (0,  B) ->   0°
//   top east  (-B,  0) ->  90°
//   top south  (0, -B) -> 180°
//   top west   (B,  0) -> 270°
export function magnetometerToHeading({ x, y, z }) {
  const heading = (Math.atan2(-x, y) * 180) / Math.PI;
  return (heading + 360) % 360;
}

// Circular angle smoothing (exponential moving average over the
// shortest arc). Handles the 0/360 wrap: 359 -> 1 goes through 0,
// never through 180.
export function circularSmooth(current, target, alpha) {
  const delta = ((target - current + 540) % 360) - 180;
  return (current + alpha * delta + 360) % 360;
}
