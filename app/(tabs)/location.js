import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, LayoutAnimation, UIManager, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { useAppData } from "../../utils/AppDataContext";
import CitySearch from "../../components/CitySearch";
import { isSameCity } from "../../utils/city";

// Enable LayoutAnimation on Android (one-time, standard pattern).
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Soft native layout animation for list mutations (add/remove a saved
// city): rows glide into place instead of jumping. LayoutAnimation is
// fully native — no per-frame JS work, safe for performance.
const LIST_ANIM = LayoutAnimation.create(240, LayoutAnimation.Types.easeOutEaseIn, LayoutAnimation.Properties.opacity);

// Location screen: GPS auto-detect, city search, and management of the
// SAVED CITIES list (add via search, remove, quick-switch). Selecting
// a city only changes selectedCity — GPS is untouched.
//
// Layout: ONE vertical ScrollView with the fixed order
//   [Определить автоматически] -> [Поиск города] -> [Сохранённые города]
// so nothing ever escapes the screen and the whole page scrolls
// naturally. The saved-cities block grows downward.
export default function LocationScreen() {
  const { colors } = useAppTheme();
  const {
    city,
    selectedCity,
    currentLocation,
    locationMode,
    locationStatus,
    savedCities,
    selectCity,
    selectCityFromGps,
    requestLocationAgain,
    deleteSavedCity,
  } = useAppData();
  const router = useRouter();

  const handleSelect = async (item) => {
    // No LayoutAnimation here on purpose: the next layout change is the
    // tab transition itself, and a pending layout animation would grab it
    // (a jerk on the Location screen). The added list row is not visible
    // anyway — the user is immediately taken to Home.
    await selectCity(item);
    router.push("/");
  };

  const handleAutoDetect = async () => {
    await requestLocationAgain();
    router.push("/");
  };

  const renderSavedCity = (item) => {
    const active = isSameCity(item, selectedCity);
    return (
      <View
        key={item.id}
        style={[
          styles.savedRow,
          {
            borderColor: active ? colors.accent : colors.border,
            backgroundColor: active ? colors.accentSoft : colors.card,
          },
        ]}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={() => handleSelect(item)}>
          <Text style={[styles.savedName, { color: active ? colors.accent : colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.savedSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {[item.region, item.country].filter(Boolean).join(", ")}
            {item.fromGps ? " · по геолокации" : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            deleteSavedCity(item);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Удалить город"
        >
          <Ionicons name="trash-outline" size={19} color={colors.danger} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Местоположение</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* current selection card */}
        <View style={[styles.currentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="location" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cityName, { color: colors.text }]}>
              {selectedCity ? `${selectedCity.name}${selectedCity.country ? `, ${selectedCity.country}` : ""}` : "Не выбрано"}
            </Text>
            <Text style={[styles.mode, { color: colors.textSecondary }]}>
              {selectedCity?.fromGps
                ? "Расписание города определено по GPS"
                : selectedCity
                ? "Город выбран вручную"
                : ""}
            </Text>
            {currentLocation && !isSameCity(currentLocation, selectedCity) ? (
              <Text style={[styles.gpsNote, { color: colors.textSecondary }]} numberOfLines={2}>
                GPS: {currentLocation.name} — используется для мечетей и Киблы
              </Text>
            ) : null}
          </View>
        </View>

        {/* 1. auto-detect button */}
        <TouchableOpacity style={[styles.detectButton, { borderColor: colors.accent }]} onPress={handleAutoDetect}>
          <Ionicons name="navigate" size={18} color={colors.accent} />
          <Text style={[styles.detectText, { color: colors.accent }]}>
            {locationStatus === "locating" ? "Определяем…" : "Определить автоматически"}
          </Text>
        </TouchableOpacity>

        {/* 2. city search directly BELOW the detect button */}
        <Text style={[styles.subtitle, { color: colors.text }]}>Найдите город</Text>
        <CitySearch onSelect={handleSelect} />

        {/* 3. saved cities: grows downward inside the same scroll */}
        {savedCities.length > 0 ? (
          <View style={styles.savedBlock}>
            <Text style={[styles.subtitle, { color: colors.text }]}>Сохранённые города</Text>
            <View style={{ gap: 8 }}>
              {savedCities.map((c) => renderSavedCity(c))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 20, paddingTop: 4 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 16 },
  currentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cityName: { fontSize: 16, fontWeight: "700" },
  mode: { fontSize: 13, marginTop: 2 },
  gpsNote: { fontSize: 12, marginTop: 4 },
  detectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  detectText: { fontWeight: "700", fontSize: 15 },
  subtitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  savedBlock: { marginTop: 24 },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  savedName: { fontSize: 15, fontWeight: "700" },
  savedSub: { fontSize: 12, marginTop: 2 },
});
