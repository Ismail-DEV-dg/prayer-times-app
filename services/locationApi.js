import * as Location from "expo-location";

// Checks whether device location services (GPS toggle in Android settings/shade) are turned on
export async function isLocationServicesEnabled() {
  try {
    return await Location.isLocationEnabledAsync();
  } catch (e) {
    return true; // assume true on error so we don't prematurely block
  }
}

// Permission status: 'granted' | 'denied' | 'unavailable'
export async function getLocationPermissionStatus() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status;
  } catch (e) {
    return "unavailable";
  }
}

// Requests foreground location permission. Returns true/false.
export async function requestLocationPermission() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  } catch (e) {
    return false;
  }
}

// Gets the device's current coordinates with multi-tier fallback and safe timeouts.
// Never hangs, never crashes, and handles Coarse location (Android 12+).
export async function getCurrentCoords() {
  const tryPosition = (accuracy, timeoutMs) => {
    return Promise.race([
      Location.getCurrentPositionAsync({ accuracy }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("LOCATION_TIMEOUT")), timeoutMs)
      ),
    ]);
  };

  // 1. High accuracy (GPS satellites, 6s timeout)
  try {
    const location = await tryPosition(Location.Accuracy.High, 6000);
    if (location && location.coords) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    }
  } catch (_) {}

  // 2. Balanced accuracy (WiFi / Cell towers, 6s timeout)
  try {
    const location = await tryPosition(Location.Accuracy.Balanced, 6000);
    if (location && location.coords) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    }
  } catch (_) {}

  // 3. Last known position (instant hardware cache)
  try {
    const last = await Location.getLastKnownPositionAsync();
    if (last && last.coords) {
      return {
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
      };
    }
  } catch (_) {}

  // 4. Lowest accuracy (handles coarse permission or weak signal, 4s timeout)
  try {
    const location = await tryPosition(Location.Accuracy.Lowest, 4000);
    if (location && location.coords) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    }
  } catch (_) {}

  throw new Error("LOCATION_UNAVAILABLE");
}

// Reverse-geocodes coordinates into a city + country using the device's geocoder.
// Fully guarded against native Geocoder missing/offline crashes.
export async function reverseGeocode(latitude, longitude) {
  try {
    const results = await Promise.race([
      Location.reverseGeocodeAsync({ latitude, longitude }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("GEOCODE_TIMEOUT")), 5000)),
    ]);
    if (!results || results.length === 0) {
      return { city: null, country: null, region: null, timezone: null };
    }
    const r = results[0];
    return {
      city: r.city || r.subregion || r.district || r.region || null,
      country: r.country || null,
      region: r.region || null,
      timezone: r.timezone || null,
    };
  } catch (e) {
    return { city: null, country: null, region: null, timezone: null };
  }
}
