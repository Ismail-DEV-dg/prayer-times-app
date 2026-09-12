// City search with autocomplete, powered by the free Open-Meteo Geocoding API.
// No API key required. https://open-meteo.com/en/docs/geocoding-api

const BASE_URL = "https://geocoding-api.open-meteo.com/v1/search";

export async function searchCities(query) {
  const trimmed = (query || "").trim();
  if (trimmed.length < 2) return [];

  const url = `${BASE_URL}?name=${encodeURIComponent(trimmed)}&count=10&language=ru&format=json`;

  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    throw new Error("NETWORK_ERROR");
  }

  if (!response.ok) throw new Error("API_ERROR");

  const data = await response.json();
  if (!data.results) return [];

  return data.results.map((r) => ({
    id: String(r.id),
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  }));
}
