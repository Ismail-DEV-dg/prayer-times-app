import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  requestLocationPermission,
  isLocationServicesEnabled,
  getCurrentCoords,
  reverseGeocode,
  getIpLocation,
} from "../services/locationApi";
import { fetchPrayerTimes, methodName } from "../services/prayerApi";
import { searchMosquesNear } from "../services/mosquesApi";
import { normalizeCity, isSameCity } from "./city";
import {
  getSelectedCity,
  saveSelectedCity,
  getSavedCities,
  addSavedCity,
  removeSavedCity,
  getSavedMethod,
  saveMethod,
  savePrayerCache,
  getPrayerCache,
} from "./storage";

const AppDataContext = createContext(null);

const DAY_MS = 24 * 60 * 60 * 1000;

// Is a cached schedule still trustworthy? Full day -> stale.
function isCacheFresh(cached, timezone) {
  if (!cached || !cached.cachedAt || !cached.payload) return false;
  const age = Date.now() - cached.cachedAt;
  if (age < 0 || age > DAY_MS) return false;
  // Cache must be for the same city-calendar day it was written on.
  try {
    const { todayInTimeZone } = require("./time");
    const today = todayInTimeZone(timezone);
    return cached.day === today;
  } catch (e) {
    return false;
  }
}

export function AppDataProvider({ children }) {
  // status of the prayer screen: 'loading' | 'ready' | 'need-city' | 'error' | 'offline-cache'
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  // ENTITY A: currentLocation — the phone's real GPS position.
  // Used ONLY for mosques, qibla and "detect my city".
  const [currentLocation, setCurrentLocation] = useState(null); // { latitude, longitude, city, country, ... }
  const [locationStatus, setLocationStatus] = useState("idle"); // 'idle' | 'locating' | 'ready' | 'denied' | 'error'

  // ENTITY B: selectedCity — the city whose schedule the user views.
  const [selectedCity, setSelectedCity] = useState(null);

  // ENTITY C: savedCities — the user's saved list.
  const [savedCities, setSavedCities] = useState([]);

  const [calcMethod, setCalcMethodState] = useState(null); // null until loaded; number afterwards
  const [methodOverridden, setMethodOverridden] = useState(false); // user explicitly picked a method
  const [prayerData, setPrayerData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // BACKGROUND mosque prefetch. Pure DATA: runs silently once GPS is
  // known, stores results for the /mosques screen. It never touches
  // navigation and never blocks or affects the prayer schedule. The
  // user never sees this happening.
  const [mosquesCache, setMosquesCache] = useState(null); // { key, list } | null
  const [mosquesFetching, setMosquesFetching] = useState(false);
  const mosquesPrefetchedRef = useRef(false); // once per app session

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------- prayer loading (selectedCity only) ----------
  //
  // AUTO/MANUAL contract (no stale-closure bugs):
  //   method === null  -> AUTO: the API layer runs the official-source
  //                       resolver first, then the country default.
  //   method = number  -> MANUAL: that exact calculation method.
  // The mode is decided by the CALLER through the argument, never read
  // from the `methodOverridden` state inside this callback — state
  // updates are async and would race the immediate reload.
  // The cache key mirrors the mode: "auto" | String(method).
  const loadPrayerTimes = useCallback(async (city, method, { showLoading = true } = {}) => {
    const asNum = Number(method);
    const manual = method != null && Number.isFinite(asNum) ? asNum : null;
    const cacheKey = manual != null ? String(manual) : "auto";
    if (showLoading) setStatus("loading");
    setErrorMessage(null);
    try {
      const data = await fetchPrayerTimes({
        latitude: city.latitude,
        longitude: city.longitude,
        method: manual, // null -> AUTO inside the API layer
        timezone: city.timezone,
        country: city.country,
        name: city.name,
        region: city.region,
      });
      if (!mountedRef.current) return;
      setPrayerData(data);
      setStatus("ready");
      const { todayInTimeZone } = require("./time");
      savePrayerCache(city, cacheKey, {
        ...data,
        day: todayInTimeZone(data.timezone || city.timezone),
      });
    } catch (e) {
      if (!mountedRef.current) return;
      const code = e && e.message;
      // Offline fallback: show cache with explicit "not fresh" marker.
      // The cache of the SAME mode is used (auto cache never serves a
      // manual schedule and vice versa).
      const cached = await getPrayerCache(city, cacheKey);
      if (cached && cached.payload && cached.payload.prayers) {
        setPrayerData({
          ...cached.payload,
          fromCache: true,
          cachedAt: cached.cachedAt,
        });
        setStatus("offline-cache");
        return;
      }
      setPrayerData(null);
      setStatus("error");
      setErrorMessage(
        code === "NETWORK_ERROR"
          ? "Нет подключения к интернету. Проверьте сеть и попробуйте снова."
          : "Не удалось получить время намаза для этого города. Попробуйте ещё раз."
      );
    }
  }, []);

  // ---------- ENTITY A: GPS ----------

  const locateUser = useCallback(async () => {
    setLocationStatus("locating");
    let located = null;

    const tryIpFallback = async () => {
      const ipGeo = await getIpLocation();
      if (ipGeo) {
        return normalizeCity({
          latitude: ipGeo.latitude,
          longitude: ipGeo.longitude,
          name: ipGeo.city || "Ваше местоположение (IP)",
          country: ipGeo.country || "",
          region: ipGeo.region,
          timezone: ipGeo.timezone,
          fromGps: true,
        });
      }
      return null;
    };

    try {
      const servicesEnabled = await isLocationServicesEnabled();
      if (!servicesEnabled) {
        located = await tryIpFallback();
        if (!located) {
          if (mountedRef.current) setLocationStatus("disabled");
          return null;
        }
      } else {
        const granted = await requestLocationPermission();
        if (!granted) {
          located = await tryIpFallback();
          if (!located) {
            if (mountedRef.current) setLocationStatus("denied");
            return null;
          }
        } else {
          try {
            const coords = await getCurrentCoords();
            let geo = { city: null, country: null, region: null, timezone: null };
            try {
              geo = await reverseGeocode(coords.latitude, coords.longitude);
            } catch (_) {}
            located = normalizeCity({
              latitude: coords.latitude,
              longitude: coords.longitude,
              name: geo.city || "Ваше местоположение",
              country: geo.country || "",
              region: geo.region,
              timezone: geo.timezone,
              fromGps: true,
            });
          } catch (e) {
            // GPS failed, try IP fallback
            located = await tryIpFallback();
          }
        }
      }
    } catch (e) {
      located = await tryIpFallback();
    }

    if (located) {
      if (!mountedRef.current) return null;
      setCurrentLocation(located);
      setLocationStatus("ready");
      return located;
    } else {
      if (!mountedRef.current) return null;
      setLocationStatus("error");
      return null;
    }
  }, []);

  // Legacy name kept: screens use it to retry GPS.
  const requestLocationAgain = useCallback(async () => {
    const located = await locateUser();
    if (located) {
      await selectCityFromGps(located);
    }
    return located;
  }, [locateUser]);

  const selectCityFromGps = useCallback(async (located) => {
    const normalized = normalizeCity(located);
    if (!normalized) return;
    setSelectedCity(normalized);
    await saveSelectedCity(normalized);
    await addSavedCity(normalized);
    if (!methodOverridden) {
      const { defaultMethodForCountry } = require("../services/prayerApi");
      const nextMethod = defaultMethodForCountry(normalized.country);
      setCalcMethodState(nextMethod);
      await loadPrayerTimes(normalized, null); // AUTO: resolver first
    } else {
      await loadPrayerTimes(normalized, calcMethod); // MANUAL stays manual
    }
  }, [calcMethod, methodOverridden, loadPrayerTimes]);

  // ---------- ENTITY B: manual selection ----------

  // Silent background mosque prefetch. Triggered once per session when
  // the GPS position becomes available. Data only — no navigation, no
  // UI state on the Home screen, no effect on the prayer flow. Results
  // are kept so the /mosques screen can show them instantly.
  useEffect(() => {
    if (!currentLocation || mosquesPrefetchedRef.current) return;
    mosquesPrefetchedRef.current = true;
    const { cityId } = require("./city");
    const key = cityId(currentLocation);
    let cancelled = false;
    (async () => {
      setMosquesFetching(true);
      try {
        const list = await searchMosquesNear(currentLocation.latitude, currentLocation.longitude);
        if (!cancelled && mountedRef.current) {
          setMosquesCache({ key, list, fetchedAt: Date.now() });
        }
      } catch (e) {
        // Prefetch is best-effort: the /mosques screen will retry on
        // open with a visible loading state if nothing was cached.
      } finally {
        if (!cancelled && mountedRef.current) setMosquesFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation]);

  // The /mosques screen reads this cache; if the user moved (different
  // GPS key) the cache is ignored and the screen searches afresh.
  const getBackgroundMosques = useCallback(() => mosquesCache, [mosquesCache]);

  const selectCity = useCallback(async (city) => {
    const normalized = normalizeCity(city);
    if (!normalized) return;
    setSelectedCity(normalized);
    await saveSelectedCity(normalized);
    await addSavedCity(normalized);
    const list = await getSavedCities();
    if (mountedRef.current) setSavedCities(list);
    if (!methodOverridden) {
      const { defaultMethodForCountry } = require("../services/prayerApi");
      setCalcMethodState(defaultMethodForCountry(normalized.country));
      await loadPrayerTimes(normalized, null);
    } else {
      await loadPrayerTimes(normalized, calcMethod);
    }
  }, [calcMethod, methodOverridden, loadPrayerTimes]);

  // ---------- ENTITY C: saved cities ----------

  const addCity = useCallback(async (city) => {
    const normalized = normalizeCity(city);
    if (!normalized) return;
    const list = await addSavedCity(normalized);
    if (mountedRef.current) setSavedCities(list);
  }, []);

  const deleteSavedCity = useCallback(async (city) => {
    const list = await removeSavedCity(city);
    if (mountedRef.current) setSavedCities(list);
  }, []);

  const isCitySaved = useCallback(
    (city) => {
      const target = normalizeCity(city);
      if (!target) return false;
      return savedCities.some((c) => isSameCity(c, target));
    },
    [savedCities]
  );

  // ---------- method ----------

  const setCalcMethod = useCallback(async (methodId) => {
    setCalcMethodState(methodId);
    setMethodOverridden(true);
    await saveMethod(methodId);
    if (selectedCity) {
      await loadPrayerTimes(selectedCity, methodId);
    }
  }, [selectedCity, loadPrayerTimes]);

  // Return to AUTO source mode: official-source resolver first, then
  // the country-default calculation method. The previously stored
  // manual choice is removed from AsyncStorage; calcMethod shows the
  // effective country default (the AUTO label in Settings reads from
  // methodOverridden=false).
  const resetMethodToAuto = useCallback(async () => {
    const { removeMethod } = require("./storage");
    await removeMethod();
    setMethodOverridden(false);
    if (selectedCity) {
      const { defaultMethodForCountry } = require("../services/prayerApi");
      const auto = defaultMethodForCountry(selectedCity.country);
      setCalcMethodState(auto);
      await loadPrayerTimes(selectedCity, null);
    }
  }, [selectedCity, loadPrayerTimes]);

  const refresh = useCallback(async () => {
    if (!selectedCity) return;
    setRefreshing(true);
    await loadPrayerTimes(selectedCity, methodOverridden ? calcMethod : null, {
      showLoading: false,
    });
    setRefreshing(false);
  }, [selectedCity, calcMethod, methodOverridden, loadPrayerTimes]);

  // ---------- startup ----------

  useEffect(() => {
    (async () => {
      try {
        const [savedSelected, savedList, savedMethod] = await Promise.all([
          getSelectedCity(),
          getSavedCities(),
          getSavedMethod(),
        ]);

        if (mountedRef.current) setSavedCities(savedList || []);
        if (savedMethod != null) {
          setCalcMethodState(savedMethod);
          setMethodOverridden(true);
        }

        if (savedSelected) {
          if (mountedRef.current) setSelectedCity(savedSelected);
          if (!savedMethod) {
            const { defaultMethodForCountry } = require("../services/prayerApi");
            const m = defaultMethodForCountry(savedSelected.country);
            if (mountedRef.current) setCalcMethodState(m);
            await loadPrayerTimes(savedSelected, null);
          } else {
            await loadPrayerTimes(savedSelected, savedMethod);
          }
        } else {
          // No saved selection: run the GPS flow once. On denial or any
          // failure the user lands on "choose a city" — never blocked.
          if (mountedRef.current) setStatus("loading");
          const located = await locateUser();
          if (located) {
            await selectCityFromGps(located);
          } else {
            if (mountedRef.current) setStatus("need-city");
          }
        }
      } catch (outerErr) {
        if (mountedRef.current) {
          setStatus("need-city");
        }
      }
    })();
    // Runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      status,
      errorMessage,
      city: selectedCity, // backwards-compatible alias
      selectedCity,
      currentLocation,
      locationStatus,
      savedCities,
      calcMethod,
      methodOverridden,
      prayerData,
      refreshing,
      backgroundMosques: mosquesCache,
      backgroundMosquesFetching: mosquesFetching,
      getBackgroundMosques,
      selectCity,
      selectCityFromGps,
      requestLocationAgain,
      locateUser,
      addCity,
      deleteSavedCity,
      isCitySaved,
      setCalcMethod,
      resetMethodToAuto,
      refresh,
    }),
    [
      status,
      errorMessage,
      selectedCity,
      currentLocation,
      locationStatus,
      savedCities,
      calcMethod,
      methodOverridden,
      prayerData,
      refreshing,
      mosquesCache,
      mosquesFetching,
      getBackgroundMosques,
      selectCity,
      selectCityFromGps,
      requestLocationAgain,
      locateUser,
      addCity,
      deleteSavedCity,
      isCitySaved,
      setCalcMethod,
      resetMethodToAuto,
      refresh,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
