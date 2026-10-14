import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fonts, radii } from "../theme/theme";
import { getNextPrayer, getMsUntilPrayer } from "../utils/time";

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

function formatDuration(ms) {
  const totalMins = Math.max(0, Math.floor(ms / (1000 * 60)));
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;
  if (hours > 0) {
    return `${hours} ч ${minutes} мин`;
  }
  return `${minutes} мин`;
}

export default function NextPrayer({ prayers, timezone }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!prayers || prayers.length === 0) return null;

  const next = getNextPrayer(prayers, timezone);
  if (!next) return null;

  const msLeft = getMsUntilPrayer(next.time, timezone, next.tomorrow);
  const prayerDisplayName = PRAYER_NAMES[next.name] || next.name;
  const timeRemainingText = formatDuration(msLeft);

  const labelText = next.tomorrow
    ? "СЛЕДУЮЩИЙ НАМАЗ · ЗАВТРА"
    : "СЛЕДУЮЩИЙ НАМАЗ · СЕГОДНЯ";

  return (
    <View style={styles.card}>
      {/* Triple Arch SVG background (matching exact reference positioning) */}
      <Svg
        width={128}
        height={147}
        viewBox="234 63 128 147"
        fill="none"
        pointerEvents="none"
        style={{ position: 'absolute', right: -12, bottom: 0 }}
      >
        <Path d="M235.5 210V128a62.5 62.5 0 0 1 125 0V210" stroke="#2C4238" strokeWidth={1.5} />
        <Path d="M256.5 210V130.5a41.5 41.5 0 0 1 83 0V210" stroke="#2C4238" strokeWidth={1.5} />
        <Path d="M280.5 210V138.5a17.5 17.5 0 0 1 35 0V210" stroke="#2C4238" strokeWidth={1.5} />
      </Svg>

      {/* Header Label */}
      <Text style={styles.label}>{labelText}</Text>

      {/* Prayer Name */}
      <Text style={styles.name}>{prayerDisplayName}</Text>

      {/* Prayer Time */}
      <Text style={styles.time}>{next.time}</Text>

      {/* Pill Badge slightly cut off at the bottom card edge */}
      <View style={styles.pill}>
        <View style={styles.pillDot} />
        <Text style={styles.pillMuted}>через</Text>
        <Text style={styles.pillTime}>{timeRemainingText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 218,
    borderRadius: radii.hero, // 28
    backgroundColor: colors.surface, // #15241F
    borderWidth: 1,
    borderColor: colors.border, // #243630
    padding: 22,
    overflow: "hidden",
    position: "relative",
    justifyContent: "flex-start",
  },
  label: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.accent, // #E3BE72
  },
  name: {
    fontFamily: fonts.serif.semibold,
    fontSize: 40,
    color: colors.text, // #EDE6D6
    lineHeight: 46,
    marginTop: 4,
  },
  time: {
    fontFamily: fonts.ui.bold,
    fontSize: 68,
    letterSpacing: -2,
    color: colors.text,
    fontVariant: ["tabular-nums"],
    lineHeight: 70,
    marginTop: 2,
  },
  pill: {
    position: "absolute",
    left: 22,
    bottom: 16, // целиком внутри карточки с отступом 16 px от низа
    backgroundColor: colors.bg, // #0D1613
    borderWidth: 1,
    borderColor: colors.borderStrong, // #2C4238
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent, // #E3BE72
  },
  pillMuted: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    color: colors.muted, // #8FA89E
  },
  pillTime: {
    fontFamily: fonts.ui.bold,
    fontSize: 15,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
});
