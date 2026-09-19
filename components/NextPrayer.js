import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { getNextPrayer, getMsUntilPrayer, formatCountdown } from "../utils/time";

const PRAYER_NAMES = {
  Fajr: "Фаджр",
  Sunrise: "Восход",
  Dhuhr: "Зухр",
  Asr: "Аср",
  Maghrib: "Магриб",
  Isha: "Иша",
};

// Hero Next Prayer card matching the Settings mockup style
export default function NextPrayer({ prayers, timezone }) {
  const { colors } = useTheme();
  const [, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!prayers || prayers.length === 0) return null;

  const next = getNextPrayer(prayers, timezone);
  if (!next) return null;

  const msLeft = getMsUntilPrayer(next.time, timezone, next.tomorrow);
  const isSoon = msLeft > 0 && msLeft <= 15 * 60 * 1000;
  const prayerDisplayName = PRAYER_NAMES[next.name] || next.name;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.heroCardBg || colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Left: Official App Avatar Emblem Badge */}
      <View
        style={[
          styles.emblemCircle,
          {
            backgroundColor: colors.badgeBg || "rgba(255,255,255,0.1)",
            borderColor: colors.badgeBorder || colors.accent,
          },
        ]}
      >
        <Image
          source={require("../assets/icon.png")}
          style={styles.emblemImage}
          resizeMode="cover"
        />
      </View>

      {/* Right: Next Prayer Info & Countdown */}
      <View style={styles.contentCol}>
        <View style={styles.headerRow}>
          <Text style={[styles.prayerName, { color: colors.text }]}>
            {prayerDisplayName}
          </Text>

          <View
            style={[
              styles.pillBadge,
              {
                backgroundColor: isSoon
                  ? colors.accentSoft
                  : colors.badgeBg || colors.cardSecondary,
                borderColor: isSoon ? colors.accent : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: isSoon ? colors.accent : colors.textSecondary },
              ]}
            >
              {isSoon ? "СКОРО" : formatCountdown(msLeft)}
            </Text>
          </View>
        </View>

        <Text style={[styles.prayerTime, { color: colors.text }]}>{next.time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  emblemCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    overflow: "hidden",
  },
  emblemImage: {
    width: "100%",
    height: "100%",
    borderRadius: 25,
  },
  contentCol: {
    flex: 1,
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  prayerName: {
    fontSize: 15,
    fontWeight: "700",
  },
  prayerTime: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.5,
  },
});
