import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";

const OPTIONS = [
  { key: "light", label: "Светлая" },
  { key: "dark", label: "Тёмная" },
  { key: "system", label: "Системная" },
];

export default function ThemeSelector() {
  const { themeMode, setThemeMode, colors } = useAppTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {OPTIONS.map((opt) => {
        const active = themeMode === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.option, active && { backgroundColor: colors.accent }]}
            onPress={() => setThemeMode(opt.key)}
          >
            <Text style={[styles.label, { color: active ? colors.textOnActive : colors.text }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  option: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  label: { fontSize: 14, fontWeight: "600" },
});
