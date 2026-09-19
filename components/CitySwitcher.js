import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../theme/ThemeContext";
import { useAppData } from "../utils/AppDataContext";
import { isSameCity } from "../utils/city";

// Horizontal quick-switcher over the user's SAVED cities.
// Selecting a city changes ONLY the schedule (selectedCity); the GPS
// position (currentLocation) stays untouched. Add/remove of the
// current city lives on the Home screen's dedicated button.
// Tapping the current city chip opens the Location screen so the user
// can search or switch — consistent with tapping the header city name.
export default function CitySwitcher() {
  const { colors } = useAppTheme();
  const { savedCities, selectedCity, selectCity } = useAppData();
  const router = useRouter();

  const current = selectedCity;

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {current && (
          <TouchableOpacity
            style={[
              styles.chip,
              { borderColor: colors.accent, backgroundColor: colors.accentSoft },
            ]}
            onPress={() => router.push("/location")}
            accessibilityLabel="Открыть экран местоположения"
          >
            <Ionicons name="location" size={13} color={colors.accent} />
            <Text style={[styles.chipText, { color: colors.accent }]} numberOfLines={1}>
              {current.name}
            </Text>
          </TouchableOpacity>
        )}
        {savedCities
          .filter((c) => !isSameCity(c, current))
          .map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => selectCity(c)}
            >
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  row: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 160,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
});
