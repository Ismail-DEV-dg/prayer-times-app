import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeContext";

export default function LocationHeader({ city, country }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <Ionicons name="location" size={20} color={colors.accent} />
      <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
        {city ? `${city}${country ? `, ${country}` : ""}` : "Определяем местоположение…"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  text: { fontSize: 20, fontWeight: "700" },
});
