// City entity helpers shared across storage, context and screens.

export function cityId({ name, country, latitude, longitude }) {
  return [
    String(name || "").trim().toLowerCase(),
    String(country || "").trim().toLowerCase(),
    Number(latitude ?? 0).toFixed(2),
    Number(longitude ?? 0).toFixed(2),
  ].join("|");
}

export function normalizeCity(city) {
  if (!city) return null;
  const latitude = Number(city.latitude);
  const longitude = Number(city.longitude);
  if (!isFinite(latitude) || !isFinite(longitude)) return null;
  return {
    id: city.id || cityId(city),
    name: String(city.name || "").trim() || "Неизвестный город",
    country: city.country ? String(city.country) : "",
    region: city.region || city.admin1 || null,
    latitude,
    longitude,
    timezone: city.timezone || null,
    fromGps: Boolean(city.fromGps),
  };
}

export function isSameCity(a, b) {
  if (!a || !b) return false;
  return cityId(a) === cityId(b);
}
