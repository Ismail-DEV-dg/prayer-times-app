// Mosque search via the OpenStreetMap Overpass API.
//
// IMPORTANT: mosques are searched around the user's CURRENT GPS
// location (currentLocation), never around the selected city.
// No fabricated mosques: results come only from real OSM data; if the
// query fails or returns nothing we surface that honestly.

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// km
const SEARCH_RADIUS_M = 5000;

function buildQuery(lat, lon, radiusM) {
  return (
    `[out:json][timeout:25];` +
    `(` +
    `node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lon});` +
    `way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lon});` +
    `relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusM},${lat},${lon});` +
    `);` +
    `out center tags;`
  );
}

async function fetchWithTimeout(url, body, ms = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      method: "POST",
      // Custom UA required: the default RN/undici Accept header makes
      // Overpass answer 406.
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "PrayerTimesApp/1.0 (Expo; contact: app@prayertimes.local)",
      },
      body: "data=" + encodeURIComponent(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Haversine distance in meters.
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(m) {
  if (m < 1000) return `${Math.round(m)} м`;
  return `${(m / 1000).toFixed(1)} км`;
}

function mapElement(el, userLat, userLon) {
  const lat = el.lat != null ? el.lat : el.center ? el.center.lat : null;
  const lon = el.lon != null ? el.lon : el.center ? el.center.lon : null;
  if (lat == null || lon == null) return null;
  const tags = el.tags || {};
  const name =
    tags["name:ru"] || tags.name || tags["name:en"] || null;
  return {
    id: `${el.type}/${el.id}`,
    osmType: el.type,
    osmId: el.id,
    name,
    address: [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ") || null,
    website: tags.website || null,
    phone: tags.phone || tags["contact:phone"] || null,
    latitude: lat,
    longitude: lon,
    distanceMeters: distanceMeters(userLat, userLon, lat, lon),
    distanceLabel: formatDistance(distanceMeters(userLat, userLon, lat, lon)),
  };
}

// Returns a sorted list of mosques near the CURRENT location.
// Throws NETWORK_ERROR / API_ERROR. Empty result is a valid outcome.
export async function searchMosquesNear(latitude, longitude) {
  const query = buildQuery(latitude, longitude, SEARCH_RADIUS_M);

  let lastError = new Error("NETWORK_ERROR");
  for (const endpoint of OVERPASS_ENDPOINTS) {
    let response;
    try {
      response = await fetchWithTimeout(endpoint, query);
    } catch (e) {
      lastError = new Error("NETWORK_ERROR");
      continue;
    }
    if (!response.ok) {
      lastError = new Error("API_ERROR");
      continue;
    }
    try {
      const json = await response.json();
      const mosques = (json.elements || [])
        .map((el) => mapElement(el, latitude, longitude))
        .filter(Boolean)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
      return mosques;
    } catch (e) {
      lastError = new Error("API_ERROR");
      continue;
    }
  }
  throw lastError;
}

// Opens walking route to a mosque in the external maps app.
export function buildRouteUrl(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
}
