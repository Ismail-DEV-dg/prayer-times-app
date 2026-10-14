import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../theme/ThemeContext";
import { useAppData } from "../../utils/AppDataContext";

const PRAYERS = [
  { id: "Fajr", name: "Фаджр" },
  { id: "Sunrise", name: "Восход" },
  { id: "Dhuhr", name: "Зухр" },
  { id: "Asr", name: "Аср" },
  { id: "Maghrib", name: "Магриб" },
  { id: "Isha", name: "Иша" },
];

export default function AdjustmentsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { adjustments, updateAdjustments } = useAppData();

  const changeOffset = (prayerId, delta) => {
    const current = adjustments[prayerId] || 0;
    const next = current + delta;
    updateAdjustments({ ...adjustments, [prayerId]: next });
  };

  const renderRow = (prayer) => {
    const offset = adjustments[prayer.id] || 0;
    return (
      <View key={prayer.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.prayerName, { color: colors.text }]}>{prayer.name}</Text>
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.accentSoft }]}
            onPress={() => changeOffset(prayer.id, -1)}
          >
            <Ionicons name="remove" size={20} color={colors.accent} />
          </TouchableOpacity>
          <Text style={[styles.offsetText, { color: colors.text }]}>
            {offset > 0 ? `+${offset}` : offset} мин
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.accentSoft }]}
            onPress={() => changeOffset(prayer.id, 1)}
          >
            <Ionicons name="add" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Корректировка молитв</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Если официальное расписание отличается от времени в вашей мечети на пару минут, вы можете настроить его вручную.
        </Text>
        {PRAYERS.map(renderRow)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: "800" },
  content: { padding: 20, paddingBottom: 40 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  prayerName: { fontSize: 16, fontWeight: "600" },
  controls: { flexDirection: "row", alignItems: "center", gap: 12 },
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  offsetText: { fontSize: 15, fontWeight: "500", minWidth: 50, textAlign: "center" },
});
