import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeContext";

// Compact, honest label of where the schedule comes from.
// Never shows invented sources — the string comes from the API layer.
// official_* -> shield icon + the authority name; calculated ->
// calculator icon; cache -> the explicit "not fresh" marker.
// onPress opens a small auto-dismissing info popup (2.6 s) managed by
// the parent screen; this component only renders the row itself.
export default function SourceBadge({ source, fromCache, onPress }) {
  const { colors } = useAppTheme();
  if (!source && !fromCache) return null;

  const isOfficial = source && source.type && source.type !== "calculated";
  const label = fromCache
    ? "Сохранённое расписание (нет сети)"
    : isOfficial
    ? `Источник: ${source.name}`
    : `Источник: расчётное расписание${source?.name ? ` (${source.name.replace(/^Расчётное расписание\s*\(?/, "").replace(/\)$/, "")})` : ""}`;
  const icon = fromCache
    ? "cloud-offline-outline"
    : isOfficial
    ? "shield-checkmark-outline"
    : "calculator-outline";

  return (
    <TouchableOpacity
      style={[
        styles.row,
        {
          borderColor: isOfficial && !fromCache ? colors.accent : colors.border,
          backgroundColor: isOfficial && !fromCache ? colors.accentSoft : colors.card,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.6}
      hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
      accessibilityLabel="Информация об источнике расписания"
    >
      <Ionicons
        name={icon}
        size={14}
        color={isOfficial && !fromCache ? colors.accent : colors.textSecondary}
      />
      <Text
        style={[
          styles.text,
          { color: isOfficial && !fromCache ? colors.accent : colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: { fontSize: 12, fontWeight: "600" },
});
