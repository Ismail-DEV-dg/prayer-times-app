import * as Location from "expo-location";

// Permission status: 'granted' | 'denied' | 'unavailable'
export async function getLocationPermissionStatus() {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status;
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

// Gets the device's current coordinates with a timeout.
export async function getCurrentCoords() {
  const location = await Promise.race([
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("LOCATION_TIMEOUT")), 20000)
    ),
  ]);
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

// Reverse-geocodes coordinates into a city + country using the device's
// geocoder. Works offline-ish on device; may fail without network on
// some Android builds -> callers must handle nulls.
export async function reverseGeocode(latitude, longitude) {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
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
