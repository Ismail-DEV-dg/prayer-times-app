import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import { useAppData } from "../../utils/AppDataContext";
import NextPrayer from "../../components/NextPrayer";
import PrayerTimesList from "../../components/PrayerTimesList";
import { formatDateInTimeZone, todayInTimeZone, getNextPrayer, timeToMinutes, nowInTimeZone } from "../../utils/time";
import { gregorianToHijri, formatHijriDate } from "../../utils/hijri";
import { colors, fonts, radii } from "../../theme/theme";

export default function HomeScreen() {
  const {
    status,
    errorMessage,
    city,
    prayerData,
    refreshing,
    refresh,
    requestLocationAgain,
  } = useAppData();
  const router = useRouter();

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000); // update timeline every 30s
    return () => clearInterval(timer);
  }, []);

  const renderBusy = (text) => (
    <SafeAreaView style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[styles.muted, { color: colors.muted, marginTop: 12 }]}>{text}</Text>
    </SafeAreaView>
  );

  if (status === "loading") {
    return renderBusy("Определяем время намаза…");
  }

  if (status === "need-city") {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.bg, paddingHorizontal: 24 }]}>
        <Text style={[styles.title, { color: colors.text, textAlign: "center" }]}>
          Доступ к геолокации не предоставлен
        </Text>
        <Text
          style={[styles.muted, { color: colors.muted, textAlign: "center", marginTop: 8 }]}
        >
          Выберите город вручную, чтобы увидеть время намаза.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={() => router.push("/location")}
          accessibilityLabel="Выбрать город"
          accessibilityRole="button"
        >
          <Text style={{ color: colors.onAccent, fontFamily: fonts.ui.bold }}>Выбрать город</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={requestLocationAgain} style={{ marginTop: 14 }}>
          <Text style={{ color: colors.accent, fontFamily: fonts.ui.semibold }}>
            Попробовать геолокацию снова
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (status === "error") {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.bg, paddingHorizontal: 24 }]}>
        <Text style={[styles.title, { color: colors.text, textAlign: "center" }]}>
          Что-то пошло не так
        </Text>
        <Text
          style={[styles.muted, { color: colors.muted, textAlign: "center", marginTop: 8 }]}
        >
          {errorMessage}
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={refresh}
          accessibilityLabel="Повторить"
          accessibilityRole="button"
        >
          <Text style={{ color: colors.onAccent, fontFamily: fonts.ui.bold }}>Повторить</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const tz = prayerData?.timezone || city?.timezone || null;
  const allPrayers = prayerData?.prayers || [];
  const nextPrayer = getNextPrayer(
    allPrayers.filter((p) => p.name !== "Sunrise"),
    tz
  );

  // Format Gregorian date: e.g. "Воскресенье, 11 октября 2026"
  const rawDateStr = formatDateInTimeZone(tz);
  const cleanGregorianDate = rawDateStr
    ? (rawDateStr.charAt(0).toUpperCase() + rawDateStr.slice(1)).replace(/\s*г\.?$/i, "")
    : "";

  // Format Hijri date
  const hijriText =
    (prayerData?.hijriDateRu && prayerData.hijriDateRu.text) ||
    (() => {
      try {
        const [y, m, d] = todayInTimeZone(tz).split("-").map(Number);
        return formatHijriDate(gregorianToHijri(y, m, d));
      } catch (e) {
        return null;
      }
    })();

  // Calculate day timeline progress & marker
  const cityNow = nowInTimeZone(tz);
  const nowMins = cityNow.hours * 60 + cityNow.minutes;
  const progressPercent = Math.min(100, Math.max(0, (nowMins / 1440) * 100));
  const nowTimeFormatted = `${String(cityNow.hours).padStart(2, "0")}:${String(cityNow.minutes).padStart(2, "0")}`;

  // Default percentages from reference: 19%, 25%, 49%, 62%, 72.5%, 77%
  const defaultDots = [19, 25, 49, 62, 72.5, 77];
  const targetNames = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const timelineDots = targetNames.map((name, index) => {
    const p = allPrayers.find((item) => item.name === name);
    if (p) {
      const mins = timeToMinutes(p.time);
      if (mins !== null) return (mins / 1440) * 100;
    }
    return defaultDots[index];
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
      >
        {/* Top Header Bar */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.citySelector}
              onPress={() => router.push("/location")}
              activeOpacity={0.7}
              accessibilityLabel={`Сменить город: ${city?.name || "Дербент"}`}
              accessibilityRole="button"
            >
              <Text style={styles.cityName} numberOfLines={1}>
                {city?.name || "Дербент"}
              </Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M6 9l6 6 6-6" />
              </Svg>
            </TouchableOpacity>

            <View style={styles.dateBlock}>
              <Text style={styles.dateText}>{cleanGregorianDate}</Text>
              {hijriText ? <Text style={styles.dateText}>{hijriText}</Text> : null}
            </View>
          </View>

          {/* Outline Gear Button */}
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push("/settings")}
            accessibilityLabel="Настройки"
            accessibilityRole="button"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={12} r="3" />
              <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Hero Next Prayer Card */}
        <NextPrayer
          prayers={allPrayers.filter((p) => p.name !== "Sunrise")}
          timezone={tz}
        />

        {/* Day Timeline (Шкала дня) */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineTrackContainer}>
            {/* Background 2px track */}
            <View style={styles.timelineBgTrack} />
            {/* Gold active progress track */}
            <View style={[styles.timelineProgressTrack, { width: `${progressPercent}%` }]} />
            {/* 6 empty circles (13px, border 2px accent, no fill) */}
            {timelineDots.map((dotPct, idx) => (
              <View
                key={idx}
                style={[
                  styles.timelineDot,
                  { left: `${dotPct}%` },
                ]}
              />
            ))}
            {/* Gold vertical bar marker 4x22 */}
            <View
              style={[
                styles.timelineNowMarker,
                { left: `${progressPercent}%` },
              ]}
            />
          </View>

          {/* Timeline labels */}
          <View style={styles.timelineLabels}>
            <Text style={styles.timelineLabelText}>00:00</Text>
            <Text style={styles.timelineLabelText}>сейчас {nowTimeFormatted}</Text>
            <Text style={styles.timelineLabelText}>24:00</Text>
          </View>
        </View>

        {/* Prayer Times List (6 rows, no fill, 1px borderSoft, active gold) */}
        <PrayerTimesList
          prayers={allPrayers}
          nextPrayer={nextPrayer}
          timezone={tz}
        />

        {/* Monthly Table Button (matching ListRow style) */}
        <TouchableOpacity
          style={styles.monthlyButton}
          onPress={() => {
            const now = Date.now();
            if (now - (global.lastMonthlyNav || 0) > 1000) {
              global.lastMonthlyNav = now;
              router.push("/monthly");
            }
          }}
          activeOpacity={0.7}
          accessibilityLabel="Таблица на месяц"
          accessibilityRole="button"
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" />
          </Svg>
          <Text style={styles.monthlyButtonText}>Таблица на месяц</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "column",
    gap: 4,
    flex: 1,
  },
  citySelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    alignSelf: "flex-start",
  },
  cityName: {
    fontFamily: fonts.ui.bold,
    fontSize: 24,
    color: colors.text,
    letterSpacing: -0.2,
  },
  dateBlock: {
    flexDirection: "column",
    gap: 2,
  },
  dateText: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.button, // 14
    borderWidth: 1,
    borderColor: colors.border, // #243630
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineSection: {
    flexDirection: "column",
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  timelineTrackContainer: {
    position: "relative",
    height: 22,
    justifyContent: "center",
  },
  timelineBgTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 10,
    height: 2,
    backgroundColor: colors.border, // #243630
    borderRadius: 2,
  },
  timelineProgressTrack: {
    position: "absolute",
    left: 0,
    top: 10,
    height: 2,
    backgroundColor: colors.accent, // #E3BE72
    borderRadius: 2,
  },
  timelineDot: {
    position: "absolute",
    top: 4.5,
    width: 13,
    height: 13,
    marginLeft: -6.5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.bg, // пустой кружок
  },
  timelineNowMarker: {
    position: "absolute",
    top: 0,
    width: 4,
    height: 22,
    marginLeft: -2,
    borderRadius: 4,
    backgroundColor: colors.accent, // #E3BE72
  },
  timelineLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timelineLabelText: {
    fontFamily: fonts.ui.regular,
    fontSize: 11,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
  },
  monthlyButton: {
    minHeight: 53,
    borderRadius: radii.row, // 18
    borderWidth: 1,
    borderColor: colors.borderSoft, // #1E2E28
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
    boxSizing: "border-box",
  },
  monthlyButtonText: {
    fontFamily: fonts.ui.medium,
    fontSize: 16,
    color: colors.text,
  },
  title: {
    fontFamily: fonts.ui.bold,
    fontSize: 18,
  },
  muted: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
});
