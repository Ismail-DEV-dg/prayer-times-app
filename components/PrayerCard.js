import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeContext";

const ICONS = {
  Fajr: "partly-sunny-outline",
  Sunrise: "sunny-outline",
  Dhuhr: "sunny-outline",
  Asr: "sunny",
  Maghrib: "moon-outline",
  Isha: "moon",
};

// One schedule row. `active` keeps highlighting the current/next prayer
// (existing behaviour). Subtle entrance: fade + slight rise, staggered
// by row index so the grid appears as a soft cascade (native driver).
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
      <Ionicons
        name={ICONS[name] || "time-outline"}
        size={22}
        color={active ? colors.accent : colors.textSecondary}
      />
      <Text style={[styles.name, { color: active ? colors.accent : colors.text }]}>{name}</Text>
      <Text style={[styles.time, { color: active ? colors.accent : colors.text }]}>{time}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: "31%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
  },
  name: { fontSize: 14, fontWeight: "600" },
  time: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
