import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

// Distinct, cohesive prayer icons (astronomical sun & moon phases)
// Strictly matching the aesthetic of the reference mockup.
const PRAYER_ICONS = {
  Fajr: "weather-night",
  Sunrise: "weather-sunset-up",
  Dhuhr: "weather-sunny",
  Asr: "weather-sunny",
  Maghrib: "weather-sunset-down",
  Isha: "weather-night",
};

const PRAYER_NAMES = {
  Fajr: "Фаджр",
  Sunrise: "Восход",
  Dhuhr: "Зухр",
  Asr: "Аср",
  Maghrib: "Магриб",
  Isha: "Иша",
};

export default function PrayerTimesList({ prayers, nextPrayer, timezone }) {
  const { colors } = useTheme();

  const isPassed = (prayerTime) => {
    if (!prayerTime || !timezone) return false;
    try {
      const now = new Date();
      const cityTimeStr = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);

      const [nowH, nowM] = cityTimeStr.split(":").map(Number);
      const [pH, pM] = prayerTime.split(":").map(Number);
      return nowH * 60 + nowM > pH * 60 + pM;
    } catch (e) {
      return false;
    }
  };

  return (
    <View style={styles.container}>
      {prayers.map((prayer) => {
        const isNext = nextPrayer && nextPrayer.name === prayer.name;
        const passed = !isNext && isPassed(prayer.time);

        return (
          <View
            key={prayer.name}
            style={[
              styles.row,
              {
                backgroundColor: isNext
                  ? colors.accentSoft
                  : colors.listRowBg || "transparent",
                borderColor: isNext
                  ? colors.accent
                  : colors.listRowBorder || "transparent",
                borderWidth: 1,
              },
            ]}
          >
            {/* Fixed-width icon box ensures 100% strict vertical alignment for every icon */}
            <View style={styles.iconBox}>
              <MaterialCommunityIcons
                name={PRAYER_ICONS[prayer.name] || "clock-outline"}
                size={19}
                color={isNext ? colors.accent : passed ? colors.textMuted : colors.accent}
              />
            </View>

            {/* Prayer Name */}
            <Text
              style={[
                styles.name,
                {
                  color: isNext
                    ? colors.accent
                    : passed
                    ? colors.textSecondary
                    : colors.text,
                  fontWeight: isNext ? "700" : "500",
                },
              ]}
            >
              {PRAYER_NAMES[prayer.name] || prayer.name}
            </Text>

            {/* Prayer Time */}
            <Text
              style={[
                styles.time,
                {
                  color: isNext
                    ? colors.accent
                    : passed
                    ? colors.textSecondary
                    : colors.text,
                  fontWeight: isNext ? "800" : "600",
                  opacity: passed ? 0.7 : 1,
                },
              ]}
            >
              {prayer.time}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    // Strictly zero horizontal margin differences to guarantee 1-line alignment
    marginHorizontal: 0,
    marginVertical: 1,
  },
  activeRow: {
    // Pure background tint without changing geometry
  },
  iconBox: {
    width: 28,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  time: {
    fontSize: 17,
    fontVariant: ["tabular-nums"],
  },
});
