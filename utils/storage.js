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
  // Listen mode ("Слушать") — separate UX from the reading-mode reciter.
  LISTEN_RECITER: "@prayer_times/quran_listen_reciter",
  LISTEN_POSITION: "@prayer_times/quran_listen_position",
  MOSQUE_BG: "@prayer_times/show_mosque_bg",
};

// --- theme ---

export async function saveTheme(theme) {
  await AsyncStorage.setItem(KEYS.THEME, theme);
}

export async function getSavedTheme() {
  return await AsyncStorage.getItem(KEYS.THEME);
}

// --- mosque background visibility ---

export async function saveShowMosqueBg(show) {
  await AsyncStorage.setItem(KEYS.MOSQUE_BG, JSON.stringify(Boolean(show)));
}

export async function getSavedShowMosqueBg() {
  const value = await AsyncStorage.getItem(KEYS.MOSQUE_BG);
  if (value === null) return true;
  try {
    return JSON.parse(value);
  } catch (e) {
    return true;
  }
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

// --- Listen mode ("Слушать") reciter + last position ----------------------
// Stored SEPARATELY from the reading-mode AUDIO_RECITER: the listen player
// has its own reciter universe (60 full-surah reciters) and its own
// "continue where you left off" position.
//
// The position is the OFFSET IN THE FULL SURAH TRACK (milliseconds), not
// an ayah number: the Listen player plays ONE continuous per-surah audio
// file, so the natural resume point is a track position.

export async function saveListenReciter(reciterId) {
  await AsyncStorage.setItem(KEYS.LISTEN_RECITER, reciterId);
}

export async function getListenReciter() {
  const value = await AsyncStorage.getItem(KEYS.LISTEN_RECITER);
  // migration: the old registry's ids (ey:…/af:…) no longer exist —
  // a stored value that is not in the new universe is dropped by the
  // caller (getListenReciter returns the raw string; the screens validate
  // against the registry and fall back to the default).
  return value;
}

// Position = { surah: 1..114, ms: >=0 } — the resume offset in the full
// surah track (validated on read). ms is capped at 24h to keep the
// storage sane.
export async function saveListenPosition(surah, ms) {
  const s = Number(surah);
  const m = Number(ms);
  if (!Number.isInteger(s) || s < 1 || s > 114) return;
  if (!Number.isFinite(m) || m < 0 || m > 24 * 60 * 60 * 1000) return;
  try {
    await AsyncStorage.setItem(KEYS.LISTEN_POSITION, JSON.stringify({ surah: s, ms: Math.floor(m) }));
  } catch (e) {
    // position write is best-effort only
  }
}

export async function getListenPosition() {
  try {
    const value = await AsyncStorage.getItem(KEYS.LISTEN_POSITION);
    if (!value) return null;
    const parsed = JSON.parse(value);
    const s = Number(parsed.surah);
    const m = Number(parsed.ms);
    // legacy {surah, ayah} positions have no track-ms meaning —
    // start that surah from the beginning
    if (!Number.isInteger(s) || s < 1 || s > 114) return null;
    if (!Number.isFinite(m) || m < 0) return { surah: s, ms: 0 };
    return { surah: s, ms: Math.min(Math.floor(m), 24 * 60 * 60 * 1000) };
  } catch (e) {
    return null;
  }
}
