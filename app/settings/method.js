import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { useAppData } from "../../utils/AppDataContext";
import { CALCULATION_METHODS, methodName } from "../../services/prayerApi";
import { resolvePrayerSource } from "../../services/officialSources";

// Source-mode screen. Two clearly separated modes:
//   AUTO (default)   — the resolver picks the most specific CONFIRMED
//                      official source for the selected city (e.g. the
//                      Dagestan Muftiate inside Dagestan), otherwise the
//                      country-default calculation method.
//   MANUAL           — the user's chosen calculation method; the
//                      official-source chain is skipped, the choice is
//                      never silently replaced.
// Tapping "Автоматически" while in MANUAL returns to AUTO and fully
// removes the stored manual override.
export default function MethodScreen() {
  const { colors } = useAppTheme();
  const { calcMethod, methodOverridden, selectedCity, setCalcMethod, resetMethodToAuto } =
    useAppData();
  const router = useRouter();

  const goBackSafe = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/settings");
  };

  // What AUTO would use for the selected city right now: the most
  // specific confirmed official source, or the country-default
  // calculation method. Honest — only real registry data.
  let autoSourceLabel = null;
  if (selectedCity) {
    const match = resolvePrayerSource(selectedCity);
    if (match && match.source) {
      autoSourceLabel = match.source.sourceName;
    } else {
      try {
        const { defaultMethodForCountry } = require("../../services/prayerApi");
        autoSourceLabel = `расчёт · ${methodName(defaultMethodForCountry(selectedCity.country))}`;
      } catch (e) {
        autoSourceLabel = "расчёт по стране";
      }
    }
  }

  const isAuto = !methodOverridden;

  // Single list-row renderer. `rowKey` is REQUIRED for rows rendered
  // inside .map() — without it React emits the "unique key" warning.
  const renderRow = (rowKey, active, icon, label, sublabel, onPress) => (
    <TouchableOpacity
      key={rowKey}
      style={[
        styles.methodRow,
        {
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? colors.accentSoft : colors.card,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? colors.accent : colors.textSecondary}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.methodText, { color: active ? colors.accent : colors.text }]}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={[styles.methodSub, { color: colors.textSecondary }]} numberOfLines={2}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.radio,
          { borderColor: active ? colors.accent : colors.border },
        ]}
      >
        {active ? <View style={[styles.radioDot, { backgroundColor: colors.accent }]} /> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackSafe} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Источник и метод</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ---------- AUTO ---------- */}
        <Text style={[styles.section, { color: colors.text }]}>Автоматически</Text>
        {renderRow(
          "auto",
          isAuto,
          "flash-outline",
          "Автоматически",
          selectedCity ? `Сейчас: ${autoSourceLabel}` : null,
          () => {
            // MANUAL -> AUTO: remove the stored override and reload
            // through the resolver. In AUTO this is a harmless no-op
            // (the mode is already active).
            if (methodOverridden) resetMethodToAuto();
          }
        )}
        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
          Приложение само выбирает самый подходящий официальный источник для выбранного города,
          а при его отсутствии — расчётный метод по стране.
        </Text>

        {/* ---------- MANUAL ---------- */}
        <Text style={[styles.section, { color: colors.text, marginTop: 24 }]}>
          Вручную (метод расчёта)
        </Text>
        {CALCULATION_METHODS.map((m) =>
          renderRow(
            `method-${m.id}`,
            methodOverridden && calcMethod === m.id,
            "calculator-outline",
            m.name,
            null,
            () => setCalcMethod(m.id)
          )
        )}
        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
          Ручной метод применяется сразу и не заменяется автоматическим выбором источника.
          {methodOverridden && calcMethod
            ? ` Выбран: ${methodName(calcMethod)}.`
            : ""}
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
  section: { fontSize: 13, fontWeight: "700", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  sectionHint: { fontSize: 12, lineHeight: 16, marginTop: 10 },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  methodText: { fontSize: 14, fontWeight: "600" },
  methodSub: { fontSize: 12, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
