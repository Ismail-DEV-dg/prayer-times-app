import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";

const OPTIONS = [
  { key: "system", label: "Системная", hint: "Следовать настройкам устройства" },
  { key: "light", label: "Светлая", hint: "Светлое оформление" },
  { key: "dark", label: "Тёмная", hint: "Тёмное оформление" },
];

// Theme sub-screen: pick system / light / dark. Applies immediately
// and persists (existing ThemeContext behaviour, unchanged).
export default function ThemeScreen() {
  const { colors, themeMode, setThemeMode } = useAppTheme();
  const router = useRouter();

  const goBackSafe = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/settings");
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackSafe} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Тема</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {OPTIONS.map((opt) => {
          const active = themeMode === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.option,
                {
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accentSoft : colors.card,
                },
              ]}
              onPress={() => setThemeMode(opt.key)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: active ? colors.accent : colors.text }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.optionHint, { color: colors.textSecondary }]}>{opt.hint}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: "800" },
  content: { padding: 20, paddingBottom: 40 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  optionLabel: { fontSize: 16, fontWeight: "700" },
  optionHint: { fontSize: 12, marginTop: 2 },
});
