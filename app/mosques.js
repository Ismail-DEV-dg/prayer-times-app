import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeContext";
import { useAppData } from "../utils/AppDataContext";
import { searchMosquesNear, buildRouteUrl } from "../services/mosquesApi";

// Mosque screen. Opened ONLY by the user pressing the "Мечети" button —
// never automatically. The map and the list work EXCLUSIVELY from the
// user's CURRENT GPS location — the selected city is never used here.
//
// Startup flow: after GPS is known the app silently prefetches mosques
// in the background (pure data, in AppDataContext). When the user
// opens this screen we show the prefetched results instantly; if the
// prefetch hasn't finished or failed, we search here with a visible
// loading state. Missing mosques or a failed search never affects the
// prayer schedule.
export default function MosquesScreen() {
  const { colors } = useTheme();
  const {
    currentLocation,
    locationStatus,
    locateUser,
    backgroundMosques,
    backgroundMosquesFetching,
  } = useAppData();
  const router = useRouter();

  const [mosques, setMosques] = useState(null); // null = not loaded yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadMosques = useCallback(async (lat, lon) => {
    setLoading(true);
    setError(null);
    try {
      const list = await searchMosquesNear(lat, lon);
      setMosques(list);
    } catch (e) {
      setMosques(null);
      setError(
        e.message === "NETWORK_ERROR"
          ? "Нет подключения к интернету. Список мечетей недоступен."
          : "Не удалось загрузить мечети. Попробуйте ещё раз."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const hasPosition = Boolean(currentLocation);

  // On mount: use the silent background prefetch if it matches the
  // current GPS position; otherwise search now (visible loading state
  // is fine INSIDE this screen). Never triggers navigation.
  useEffect(() => {
    if (!hasPosition) return;
    let cancelled = false;
    (async () => {
      const { cityId } = require("../utils/city");
      const key = cityId(currentLocation);
      if (backgroundMosques && backgroundMosques.key === key) {
        // Prefetch already delivered results for this exact position.
        setMosques(backgroundMosques.list);
        setError(null);
        return;
      }
      if (backgroundMosquesFetching) {
        // Prefetch is in flight for this session — wait for it briefly
        // so the user doesn't trigger a duplicate Overpass query.
        const started = Date.now();
        while (Date.now() - started < 8000 && !cancelled) {
          await new Promise((r) => setTimeout(r, 300));
        }
        if (cancelled) return;
        if (backgroundMosques && backgroundMosques.key === key) {
          setMosques(backgroundMosques.list);
          return;
        }
      }
      loadMosques(currentLocation.latitude, currentLocation.longitude);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPosition ? currentLocation.latitude : null, hasPosition ? currentLocation.longitude : null]);

  const openRoute = (mosque) => {
    const url = buildRouteUrl(mosque.latitude, mosque.longitude);
    Linking.openURL(url).catch(() => {});
  };

  // Back guard: if there is nothing to go back to (e.g. this screen
  // somehow ended up as the only screen in the stack), fall back to
  // Home instead of an unhandled GO_BACK action.
  const goBackToHome = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const renderContent = () => {
    if (!hasPosition) {
      if (locationStatus === "locating") {
        return (
          <View style={[styles.centerCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.centerText, { color: colors.textSecondary, marginTop: 10 }]}>
              Определяем ваше местоположение…
            </Text>
          </View>
        );
      }
      return (
        <View style={[styles.centerCard, { backgroundColor: colors.card }]}>
          <Ionicons name="location-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.centerTitle, { color: colors.text }]}>
            {locationStatus === "denied"
              ? "Доступ к геолокации не предоставлен"
              : locationStatus === "disabled"
              ? "Геолокация отключена на устройстве"
              : "Местоположение недоступно"}
          </Text>
          <Text style={[styles.centerText, { color: colors.textSecondary, textAlign: "center" }]}>
            {locationStatus === "disabled"
              ? "Включите геолокацию (GPS) в шторке быстрых настроек телефона, чтобы найти мечети рядом."
              : "Мечети ищутся только по вашему текущему местоположению."}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={locateUser}
          >
            <Text style={{ color: colors.textOnActive, fontWeight: "700" }}>Определить местоположение</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (loading) {
      return (
        <View style={[styles.centerCard, { backgroundColor: colors.card }]}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.centerText, { color: colors.textSecondary, marginTop: 10 }]}>
            Ищем мечети поблизости…
          </Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={[styles.centerCard, { backgroundColor: colors.card }]}>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.centerTitle, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={() => loadMosques(currentLocation.latitude, currentLocation.longitude)}
          >
            <Text style={{ color: colors.textOnActive, fontWeight: "700" }}>Повторить</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (mosques && mosques.length === 0) {
      return (
        <View style={[styles.centerCard, { backgroundColor: colors.card }]}>
          <Ionicons name="business-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.centerTitle, { color: colors.text }]}>
            Мечети поблизости не найдены
          </Text>
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.mapFallback, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="map-outline" size={28} color={colors.accent} />
          <Text style={[styles.mapFallbackTitle, { color: colors.text }]}>
            Встроенная карта отключена
          </Text>
          <Text style={[styles.mapFallbackSub, { color: colors.textSecondary }]}>
            Выберите мечеть из списка ниже, чтобы построить маршрут в вашем навигаторе.
          </Text>
        </View>
        <FlatList
          data={mosques || []}
          keyExtractor={(m) => m.id}
          style={styles.list}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <View style={[styles.mosqueCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.mosqueName, { color: colors.text }]}>
                  {item.name || "Мечеть"}
                </Text>
                {item.address ? (
                  <Text style={[styles.mosqueSub, { color: colors.textSecondary }]}>
                    {item.address}
                  </Text>
                ) : null}
                <Text style={[styles.mosqueDistance, { color: colors.accent }]}>
                  {item.distanceLabel}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.routeButton, { borderColor: colors.accent }]}
                onPress={() => openRoute(item)}
              >
                <Ionicons name="navigate" size={16} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>Маршрут</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackToHome} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Мечети поблизости</Text>
      </View>
      <View style={{ flex: 1 }}>{renderContent()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: "800" },
  map: { flex: 1 },
  list: { flex: 1 },
  centerCard: {
    margin: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  centerTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  centerText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  retryButton: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  mosqueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  mosqueName: { fontSize: 15, fontWeight: "700" },
  mosqueSub: { fontSize: 13, marginTop: 2 },
  mosqueDistance: { fontSize: 13, marginTop: 4, fontWeight: "600" },
  routeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  mapFallback: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  mapFallbackTitle: { fontSize: 14, fontWeight: "700" },
  mapFallbackSub: { fontSize: 12, textAlign: "center", lineHeight: 17 },
});
