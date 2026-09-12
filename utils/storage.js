import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeCity, cityId, isSameCity } from "./city";

const KEYS = {
  // legacy single-city key from v1.0.0 — kept for migration
  CITY: "@prayer_times/city",
  THEME: "@prayer_times/theme",
  METHOD: "@prayer_times/method",
  SELECTED_CITY: "@prayer_times/selected_city",
  SAVED_CITIES: "@prayer_times/saved_cities",
  PRAYER_CACHE: "@prayer_times/prayer_cache",
  AUDIO_RECITER: "@prayer_times/audio_reciter",
};

// --- theme ---

export async function saveTheme(theme) {
  await AsyncStorage.setItem(KEYS.THEME, theme);
}

export async function getSavedTheme() {
  return await AsyncStorage.getItem(KEYS.THEME);
}

// --- calculation method ---

export async function saveMethod(method) {
  await AsyncStorage.setItem(KEYS.METHOD, String(method));
}

export async function getSavedMethod() {
  const value = await AsyncStorage.getItem(KEYS.METHOD);
  return value ? Number(value) : null;
}

// Removes a manually chosen method -> the app returns to the AUTO
// source mode (official source resolver first).
export async function removeMethod() {
  await AsyncStorage.removeItem(KEYS.METHOD);
}

// --- selected city (whose prayer schedule the user views) ---

export async function saveSelectedCity(city) {
  const normalized = normalizeCity(city);
  if (!normalized) return;
  await AsyncStorage.setItem(KEYS.SELECTED_CITY, JSON.stringify(normalized));
}

export async function getSelectedCity() {
  const value = await AsyncStorage.getItem(KEYS.SELECTED_CITY);
  if (value) {
    const parsed = normalizeCity(JSON.parse(value));
    if (parsed) return parsed;
  }
  // migration from the old single-city storage (v1.0.0)
  const legacy = await getSavedCity();
  if (legacy) {
    const migrated = normalizeCity(legacy);
    if (migrated) {
      await saveSelectedCity(migrated);
      await addSavedCity(migrated);
      await AsyncStorage.removeItem(KEYS.CITY);
      return migrated;
    }
  }
  return null;
}

// --- saved cities list ---

export async function getSavedCities() {
  const value = await AsyncStorage.getItem(KEYS.SAVED_CITIES);
  if (!value) return [];
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list.map(normalizeCity).filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

export async function addSavedCity(city) {
  const normalized = normalizeCity(city);
  if (!normalized) return getSavedCities();
  const list = await getSavedCities();
  if (!list.some((c) => isSameCity(c, normalized))) {
    const next = [...list, normalized];
    await AsyncStorage.setItem(KEYS.SAVED_CITIES, JSON.stringify(next));
    return next;
  }
  return list;
}

export async function removeSavedCity(city) {
  const list = await getSavedCities();
  const target = normalizeCity(city);
  const next = list.filter((c) => !isSameCity(c, target));
  await AsyncStorage.setItem(KEYS.SAVED_CITIES, JSON.stringify(next));
  return next;
}

// --- legacy single-city API kept for compatibility (v1.0.0) ---

export async function saveCity(city) {
  await AsyncStorage.setItem(KEYS.CITY, JSON.stringify(city));
}

export async function getSavedCity() {
  const value = await AsyncStorage.getItem(KEYS.CITY);
  try {
    return value ? JSON.parse(value) : null;
  } catch (e) {
    return null;
  }
}

export async function clearCity() {
  await AsyncStorage.removeItem(KEYS.CITY);
}

// --- prayer times cache (offline fallback with explicit age) ---

export async function savePrayerCache(city, method, payload) {
  const key = cityId(city);
  try {
    await AsyncStorage.setItem(
      KEYS.PRAYER_CACHE,
      JSON.stringify({
        key,
        method: String(method),
        payload,
        cachedAt: Date.now(),
      })
    );
  } catch (e) {
    // cache write is best-effort only
  }
}

export async function getPrayerCache(city, method) {
  try {
    const value = await AsyncStorage.getItem(KEYS.PRAYER_CACHE);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (parsed.key !== cityId(city) || String(parsed.method) !== String(method)) {
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

// --- audio reciter preference ---

export async function saveReciter(reciterId) {
  await AsyncStorage.setItem(KEYS.AUDIO_RECITER, reciterId);
}

export async function getReciter() {
  return await AsyncStorage.getItem(KEYS.AUDIO_RECITER);
}
