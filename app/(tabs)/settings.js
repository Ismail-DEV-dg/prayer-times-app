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

// Russian plural form: 1 город, 2–4 города, 5+ городов
function pluralCities(n) {
  const abs = Math.abs(n) % 100;
  const mod10 = abs % 10;
  if (abs > 10 && abs < 20) return "городов";
  if (mod10 === 1) return "город";
  if (mod10 >= 2 && mod10 <= 4) return "города";
  return "городов";
}

// Settings tab: structured list of sections. Every large parameter
// opens its own screen (/settings/theme, /settings/method, ...);
// the main screen shows the currently selected value.
export default function SettingsScreen() {
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

  // A structured list of section rows. The whole screen is a plain
  // ScrollView — no fixed-height hacks, full vertical scroll.
  const renderRow = (icon, label, value, onPress, danger) => (
    <TouchableOpacity
      style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {value ? (
          <Text style={[styles.rowValue, { color: danger ? colors.danger : colors.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const themeValue = THEME_LABELS[themeMode] || "Системная";
  // AUTO label: the most specific confirmed official source for the
  // selected city, else the country-default calculation method.
  let methodValue = "не выбран";
  if (selectedCity) {
    const match = resolvePrayerSource(selectedCity);
    methodValue = match
      ? `Автоматически · ${match.source.sourceName}`
      : `Автоматически · ${methodName(calcMethod || 3)}`;
  } else if (methodOverridden && calcMethod) {
    methodValue = `Вручную · ${methodName(calcMethod)}`;
  }
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Настройки</Text>

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
          `${savedCities.length} ${pluralCities(savedCities.length)}`,
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
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 20 },
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
