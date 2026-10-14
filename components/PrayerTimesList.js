import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { colors, fonts, radii } from "../theme/theme";

const PRAYER_NAMES = {
  Fajr: "Фаджр",
  Sunrise: "Восход",
  Dhuhr: "Зухр",
  Asr: "Аср",
  Maghrib: "Магриб",
  Isha: "Иша",
  Tahajjud: "Тахаджуд",
  Duha: "Духа",
};

function PrayerIcon({ name, color }) {
  if (name === "Fajr" || name === "Tahajjud") {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </Svg>
    );
  }
  if (name === "Sunrise") {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 2v4M4.93 6.93l2.83 2.83M19.07 6.93l-2.83 2.83M2 18h20M6 18a6 6 0 0 1 12 0" />
      </Svg>
    );
  }
  if (name === "Dhuhr" || name === "Duha") {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={4} />
        <Path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
      </Svg>
    );
  }
  if (name === "Asr") {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={3} />
        <Path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      </Svg>
    );
  }
  if (name === "Maghrib") {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 3v5M9.5 5.5L12 8l2.5-2.5M2 18h20M6 18a6 6 0 0 1 12 0" />
      </Svg>
    );
  }
  if (name === "Isha") {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M19 13.5A7.5 7.5 0 1 1 10.5 5c.2 0 .4 0 .6.03A6.2 6.2 0 0 0 19 13.5z" />
        <Path d="M17 3v4M15 5h4" />
      </Svg>
    );
  }
  return null;
}

export default function PrayerTimesList({ prayers, nextPrayer }) {
  if (!prayers || prayers.length === 0) return null;

  return (
    <View style={styles.container}>
      {prayers.map((prayer) => {
        const isNext = nextPrayer && nextPrayer.name === prayer.name;

        return (
          <View
            key={prayer.name}
            style={[
              styles.row,
              isNext ? styles.activeRow : styles.inactiveRow,
            ]}
          >
            <PrayerIcon
              name={prayer.name}
              color={isNext ? colors.accent : colors.muted}
            />

            <Text
              style={[
                styles.name,
                isNext ? styles.activeName : styles.inactiveName,
              ]}
              numberOfLines={1}
            >
              {PRAYER_NAMES[prayer.name] || prayer.name}
            </Text>

            <Text
              style={[
                styles.time,
                isNext ? styles.activeTime : styles.inactiveTime,
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
    gap: 7,
  },
  row: {
    height: 53,
    borderRadius: radii.row, // 18
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    boxSizing: "border-box",
  },
  activeRow: {
    backgroundColor: colors.surfaceActive, // #1B2F28
    borderColor: colors.accent, // #E3BE72
  },
  inactiveRow: {
    backgroundColor: "transparent",
    borderColor: colors.borderSoft, // #1E2E28
  },
  name: {
    flex: 1,
  },
  activeName: {
    fontFamily: fonts.ui.bold,
    fontSize: 17,
    color: "#FFFFFF",
  },
  inactiveName: {
    fontFamily: fonts.ui.medium,
    fontSize: 16,
    color: colors.textDim, // #C9C2B2
  },
  time: {
    fontVariant: ["tabular-nums"],
  },
  activeTime: {
    fontFamily: fonts.ui.bold,
    fontSize: 18,
    color: colors.accent, // #E3BE72
  },
  inactiveTime: {
    fontFamily: fonts.ui.semibold,
    fontSize: 17,
    color: colors.textDim, // #C9C2B2
  },
});
