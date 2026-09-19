import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeContext";

// More distinct icons: each prayer has a unique visual cue.
// Fajr = pre-dawn (crescent + star), Sunrise = sunny + warm,
// Dhuhr = full sun overhead, Asr = afternoon (partly cloudy),
// Maghrib = sunset, Isha = night moon.
const ICONS = {
  Fajr: "moon-outline",
  Sunrise: "sunny-outline",
  Dhuhr: "sunny",
  Asr: "partly-sunny-outline",
  Maghrib: "cloudy-night-outline",
  Isha: "moon",
};

// Russian display names (existing data, display-only).
const NAMES = {
  Fajr: "Фаджр",
  Sunrise: "Восход",
  Dhuhr: "Зухр",
  Asr: "Аср",
  Maghrib: "Магриб",
  Isha: "Иша",
};

// One schedule row. `active` highlights the current/next prayer (the
// caller decides which — usually the next prayer from getNextPrayer).
// Subtle entrance: fade + slight rise, staggered by row index so the
// grid appears as a soft cascade (native driver).
export default function PrayerCard({ name, time, active, index = 0 }) {
  const { colors } = useAppTheme();
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 280,
      delay: Math.min(index, 5) * 70, // stagger 0..350 ms
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: active ? colors.accentSoft : colors.card,
          borderColor: active ? colors.accent : colors.border,
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.topRow}>
        <Ionicons
          name={ICONS[name] || "time-outline"}
          size={18}
          color={active ? colors.accent : colors.textSecondary}
        />
        {active && <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />}
      </View>
      <Text style={[styles.name, { color: active ? colors.accent : colors.text }]}>
        {NAMES[name] || name}
      </Text>
      <Text
        style={[
          styles.time,
          { color: active ? colors.accent : colors.text },
        ]}
      >
        {time}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: "31%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 6, height: 20 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  name: { fontSize: 12, fontWeight: "600" },
  time: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
