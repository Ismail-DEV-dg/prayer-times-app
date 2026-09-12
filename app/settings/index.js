import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { useAppData } from "../../utils/AppDataContext";
import { methodName } from "../../services/prayerApi";
import { resolvePrayerSource } from "../../services/officialSources";

const THEME_LABELS = { light: "Светлая", dark: "Тёмная", system: "Системная" };

// Full settings screen (opened from the Settings tab): same
// structured rows, each parameter opens its own sub-screen.
export default function FullSettingsScreen() {
  const { colors, themeMode } = useAppTheme();
  const {
    calcMethod,
    methodOverridden,
    selectedCity,
    currentLocation,
    savedCities,
    locationStatus,
    requestLocationAgain,
  } = useAppData();
  const router = useRouter();

  // Back guard: never trigger an unhandled GO_BACK; fall back to the
  // Settings tab (or Home when the stack is empty).
  const goBackSafe = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/settings");
  };

  const renderRow = (icon, label, value, onPress) => (
    <TouchableOpacity
      style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const themeValue = THEME_LABELS[themeMode] || "Системная";
  // AUTO label: the most specific confirmed official source for the
  // selected city (e.g. Dagestan Muftiate), else the country-default
  // calculation method. Honest — real registry data only.
  let autoLabel = "расчёт по стране";
  if (selectedCity) {
    const match = resolvePrayerSource(selectedCity);
    if (match) {
      autoLabel = match.source.sourceName;
    } else {
      try {
        const { defaultMethodForCountry } = require("../../services/prayerApi");
        autoLabel = `расчёт · ${methodName(defaultMethodForCountry(selectedCity.country))}`;
      } catch (e) {
        // keep default label
      }
    }
  }
  const methodValue = methodOverridden
    ? `Вручную: ${calcMethod ? methodName(calcMethod) : "—"}`
    : selectedCity
    ? `Автоматически: ${autoLabel}`
    : "Автоматически";
  const locationValue = selectedCity
    ? `${selectedCity.name}${selectedCity.fromGps ? " (по GPS)" : ""}`
    : "не выбран";
  const gpsValue = currentLocation ? currentLocation.name : "недоступен";

  const handleRedetect = async () => {
    await requestLocationAgain();
    router.push("/");
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackSafe} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Все настройки</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.section, { color: colors.text }]}>Общие</Text>
        {renderRow("color-palette-outline", "Тема", themeValue, () =>
          router.push("/settings/theme")
        )}

        <Text style={[styles.section, { color: colors.text, marginTop: 24 }]}>Местоположение</Text>
        {renderRow("location-outline", "Город расписания", locationValue, () =>
          router.push("/location")
        )}
        {renderRow("navigate-outline", "GPS-позиция", gpsValue, () => router.push("/location"))}
        {renderRow(
          "bookmark-outline",
          "Сохранённые города",
          `${savedCities.length} ${savedCities.length === 1 ? "город" : "городов"}`,
          () => router.push("/location")
        )}

        <Text style={[styles.section, { color: colors.text, marginTop: 24 }]}>Намаз</Text>
        {renderRow("time-outline", "Источник и метод", methodValue, () =>
          router.push("/settings/method")
        )}
        {renderRow(
          "locate-outline",
          "Определить местоположение заново",
          locationStatus === "locating" ? "Определяем…" : null,
          handleRedetect
        )}

        <Text style={[styles.sectionHint, { color: colors.textSecondary, marginTop: 24 }]}>
          Чтец и качество аудио аятов выбираются на экране суры в разделе «Коран».
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: "800" },
  content: { padding: 20, paddingBottom: 40 },
  section: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  sectionHint: { fontSize: 13, lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowValue: { fontSize: 12, marginTop: 2 },
});
