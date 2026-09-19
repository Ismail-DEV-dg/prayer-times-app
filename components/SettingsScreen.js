import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeContext";
import { THEMES, THEMES_META } from "../theme/colors";
import StitchMosque from "./StitchMosque";
import { useAppData } from "../utils/AppDataContext";
import { methodName } from "../services/prayerApi";
import { resolvePrayerSource } from "../services/officialSources";

// Constellation of stars for the phone preview mockup
const MOCKUP_STARS = [
  { top: 22, left: 16, size: 2.5, opacity: 0.95 },
  { top: 32, left: 62, size: 2, opacity: 0.75 },
  { top: 20, left: 110, size: 3, opacity: 1 },
  { top: 36, left: 156, size: 2, opacity: 0.7 },
  { top: 26, left: 204, size: 2.5, opacity: 0.85 },
  { top: 56, left: 26, size: 2, opacity: 0.65 },
  { top: 66, left: 88, size: 2.5, opacity: 0.8 },
  { top: 58, left: 146, size: 2, opacity: 0.7 },
  { top: 72, left: 210, size: 2.5, opacity: 0.75 },
];

// Reference prayer schedule mirroring the Main Screen (PrayerTimesList)
const MOCKUP_PRAYERS = [
  { name: "Фаджр", time: "03:45", icon: "weather-night", isNext: true },
  { name: "Восход", time: "05:16", icon: "weather-sunset-up", isNext: false, passed: true },
  { name: "Зухр", time: "11:51", icon: "weather-sunny", isNext: false, passed: true },
  { name: "Аср", time: "15:22", icon: "weather-sunny", isNext: false, passed: false },
  { name: "Магриб", time: "18:16", icon: "weather-sunset-down", isNext: false, passed: false },
  { name: "Иша", time: "19:31", icon: "weather-night", isNext: false, passed: false },
];

// Proportional Stitch vector height & lowered offset for the phone preview mockup (312:280 ratio)
export const MOCKUP_MOSQUE_HEIGHT = Math.round(278 * (280 / 312)); // 250px
export const MOCKUP_MOSQUE_BOTTOM = -Math.round(MOCKUP_MOSQUE_HEIGHT * 0.18); // -45px

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode, showMosqueBg, setShowMosqueBg } = useTheme();
  const {
    calcMethod,
    methodOverridden,
    selectedCity,
    currentLocation,
    savedCities,
    locationStatus,
    requestLocationAgain,
  } = useAppData();
  const router = useRouter();

  // Local state for live preview (allows user to see theme before tapping "Применить")
  const [previewThemeId, setPreviewThemeId] = useState(
    THEMES[themeMode] ? themeMode : "dark"
  );
  const [appliedNotice, setAppliedNotice] = useState(false);

  // Active theme data for live preview
  const previewTheme = useMemo(
    () => THEMES[previewThemeId] || THEMES.dark,
    [previewThemeId]
  );

  const handleApplyTheme = async () => {
    await setThemeMode(previewThemeId);
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 2000);
  };

  // Method & Location summary
  let methodValue = "не выбран";
  if (selectedCity) {
    const match = resolvePrayerSource(selectedCity);
    methodValue = match
      ? `Авто · ${match.source.sourceName}`
      : `Авто · ${methodName(calcMethod || 3)}`;
  } else if (methodOverridden && calcMethod) {
    methodValue = `Вручную · ${methodName(calcMethod)}`;
  }
  const locationValue = selectedCity
    ? `${selectedCity.name}${selectedCity.fromGps ? " (по GPS)" : ""}`
    : "не выбран";

  const renderCalculationRow = (icon, label, value, onPress) => (
    <TouchableOpacity
      style={[
        styles.calcRow,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.calcIconWrap,
          { backgroundColor: colors.accentSoft || "rgba(255,255,255,0.06)" },
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.calcRowLabel, { color: colors.text }]}>{label}</Text>
        {value ? (
          <Text
            style={[styles.calcRowValue, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {router.canGoBack() ? (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginBottom: 10, alignSelf: "flex-start" }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.title, { color: colors.text }]}>Оформление темы</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Выберите стиль интерфейса и цветовую схему
          </Text>
        </View>

        {/* ================= 1. LIVE PREVIEW MOCKUP SECTION ================= */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
            ПРЕДПРОСМОТР
          </Text>
          <View style={styles.previewControls}>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: colors.textSecondary }]}>
                Фон мечети
              </Text>
              <Switch
                value={showMosqueBg}
                onValueChange={setShowMosqueBg}
                trackColor={{
                  false: colors.border,
                  true: previewTheme.accent,
                }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>
            <View
              style={[
                styles.themeBadgePill,
                {
                  backgroundColor: previewTheme.badgeBg || "rgba(255,255,255,0.1)",
                  borderColor: previewTheme.badgeBorder || previewTheme.accent,
                },
              ]}
            >
              <Text style={[styles.themeBadgeText, { color: previewTheme.accent }]}>
                {previewTheme.name}
              </Text>
            </View>
          </View>
        </View>

        {/* Live Phone Mockup Container */}
        <View style={styles.mockupOuterWrapper}>
          <View style={[styles.phoneFrame, { borderColor: colors.border }]}>
            {/* Dynamic Island bar */}
            <View style={styles.dynamicIsland} />

            {/* Mockup Screen Content */}
            <View
              style={[
                styles.mockupScreen,
                { backgroundColor: previewTheme.background },
              ]}
            >
              {/* Optional Mosque Artwork Background */}
              <View style={styles.mockupBackdropContainer} pointerEvents="none">
                {/* Sky Gradient tint */}
                <View
                  style={[
                    styles.mockupSkyGradient,
                    {
                      backgroundColor:
                        previewTheme.skyGradient?.[0] || previewTheme.background,
                    },
                  ]}
                />

                {/* Stars (for dark themes) */}
                {previewTheme.showStars && (
                  <View style={styles.mockupStarsRow}>
                    {MOCKUP_STARS.map((s, i) => (
                      <View
                        key={i}
                        style={[
                          styles.starDot,
                          {
                            top: s.top,
                            left: s.left,
                            width: s.size,
                            height: s.size,
                            borderRadius: s.size / 2,
                            opacity: s.opacity,
                          },
                        ]}
                      />
                    ))}
                  </View>
                )}

                {/* Celestial Element (Moon or Sun) positioned safely next to date */}
                <View style={styles.mockupCelestial}>
                  <Ionicons
                    name={previewTheme.celestialType === "sun" ? "sunny" : "moon"}
                    size={16}
                    color={previewTheme.celestialColor || (previewTheme.isDark ? "#E0ECFB" : "#E5A84B")}
                  />
                </View>

                {/* Mosque Silhouette in mockup, matching main screen edge-to-edge stretch (strictly NO domes) */}
                {showMosqueBg && (
                  <View style={styles.mockupMosqueWrap} pointerEvents="none">
                    <StitchMosque
                      idPrefix="mockup"
                      colors={previewTheme}
                      width="100%"
                      height={MOCKUP_MOSQUE_HEIGHT}
                      preserveAspectRatio="none"
                    />
                  </View>
                )}
              </View>

              {/* Status bar inside mockup */}
              <View style={styles.mockupStatusBar}>
                <Text
                  style={[
                    styles.mockupStatusTime,
                    { color: previewTheme.text },
                  ]}
                >
                  9:41
                </Text>
                <View style={styles.mockupStatusIcons}>
                  <Ionicons name="cellular" size={10} color={previewTheme.text} />
                  <Ionicons name="wifi" size={10} color={previewTheme.text} />
                  <Ionicons name="battery-full" size={12} color={previewTheme.text} />
                </View>
              </View>

              {/* Main Content Flow (mirrors HomeScreen) */}
              <View style={styles.mockupMainFlow}>
                {/* Header Row: City selector on left, Settings gear on right */}
                <View style={styles.mockupHeaderRow}>
                  <View style={styles.mockupLocationPill}>
                    <Ionicons
                      name="location-sharp"
                      size={11}
                      color={previewTheme.accent}
                    />
                    <Text
                      style={[
                        styles.mockupLocationText,
                        { color: previewTheme.text },
                      ]}
                      numberOfLines={1}
                    >
                      Мекка
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={9}
                      color={previewTheme.textSecondary}
                    />
                  </View>
                  <Ionicons
                    name="settings-outline"
                    size={13}
                    color={previewTheme.text}
                  />
                </View>

                {/* Date Row */}
                <View style={styles.mockupDateSection}>
                  <Text
                    style={[
                      styles.mockupDateSolar,
                      { color: previewTheme.text },
                    ]}
                  >
                    Сегодня, 16 апреля 2025
                  </Text>
                  <Text
                    style={[
                      styles.mockupDateHijri,
                      { color: previewTheme.hijriColor || previewTheme.textSecondary },
                    ]}
                  >
                    17 рамадан 1446
                  </Text>
                </View>

                {/* Hero Active Prayer Card (identical to NextPrayer.js) */}
                <View
                  style={[
                    styles.mockupHeroCard,
                    {
                      backgroundColor:
                        previewTheme.heroCardBg || previewTheme.card,
                      borderColor: previewTheme.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.mockupPrayerBadge,
                      {
                        backgroundColor:
                          previewTheme.badgeBg || "rgba(255,255,255,0.1)",
                        borderColor: previewTheme.badgeBorder || previewTheme.accent,
                      },
                    ]}
                  >
                    <Image
                      source={require("../assets/icon.png")}
                      style={styles.mockupPrayerBadgeImage}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.mockupPrayerTitleRow}>
                      <Text
                        style={[
                          styles.mockupPrayerName,
                          { color: previewTheme.text },
                        ]}
                      >
                        Фаджр
                      </Text>
                      <View
                        style={[
                          styles.mockupSoonPill,
                          {
                            backgroundColor:
                              previewTheme.accentSoft || previewTheme.badgeBg || "rgba(255,255,255,0.15)",
                            borderColor: previewTheme.accent,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.mockupSoonText,
                            { color: previewTheme.accent },
                          ]}
                        >
                          СКОРО
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.mockupPrayerTime,
                        { color: previewTheme.text },
                      ]}
                    >
                      03:45
                    </Text>
                  </View>
                </View>

                {/* Timetable Rows in Mockup (PrayerTimesList style) */}
                <View style={styles.mockupScheduleList}>
                  {MOCKUP_PRAYERS.map((item, idx) => {
                    const rowBg = item.isNext
                      ? (previewTheme.accentSoft || "rgba(16,185,129,0.15)")
                      : (previewTheme.listRowBg || "transparent");
                    const rowBorder = item.isNext
                      ? previewTheme.accent
                      : (previewTheme.listRowBorder || "transparent");
                    const textColor = item.isNext
                      ? previewTheme.accent
                      : item.passed
                      ? (previewTheme.textMuted || previewTheme.textSecondary)
                      : previewTheme.text;
                    const iconColor = item.isNext
                      ? previewTheme.accent
                      : item.passed
                      ? (previewTheme.textMuted || previewTheme.textSecondary)
                      : previewTheme.accent;

                    return (
                      <View
                        key={idx}
                        style={[
                          styles.mockupScheduleRow,
                          {
                            backgroundColor: rowBg,
                            borderColor: rowBorder,
                            borderWidth: item.isNext ? 1 : (previewTheme.listRowBorder ? 1 : 0),
                          },
                        ]}
                      >
                        <View style={styles.mockupScheduleRowLeft}>
                          <View style={styles.mockupIconBox}>
                            <MaterialCommunityIcons
                              name={item.icon}
                              size={12}
                              color={iconColor}
                            />
                          </View>
                          <Text
                            style={[
                              styles.mockupScheduleTitle,
                              {
                                color: textColor,
                                fontWeight: item.isNext ? "700" : "500",
                              },
                            ]}
                          >
                            {item.name}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.mockupScheduleTime,
                            {
                              color: textColor,
                              fontWeight: item.isNext ? "800" : "600",
                              opacity: item.passed ? 0.7 : 1,
                            },
                          ]}
                        >
                          {item.time}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Mini Bottom Tab bar in Mockup */}
              <View
                style={[
                  styles.mockupTabBar,
                  {
                    borderTopColor: previewTheme.border,
                    backgroundColor: previewTheme.card,
                  },
                ]}
              >
                <View style={styles.mockupTabItem}>
                  <Ionicons name="home" size={11} color={previewTheme.accent} />
                  <Text
                    style={[
                      styles.mockupTabLabel,
                      { color: previewTheme.accent, fontWeight: "700" },
                    ]}
                  >
                    Главная
                  </Text>
                </View>
                <View style={styles.mockupTabItem}>
                  <Ionicons
                    name="book-outline"
                    size={11}
                    color={previewTheme.tabMutedColor || "#888"}
                  />
                  <Text
                    style={[
                      styles.mockupTabLabel,
                      { color: previewTheme.tabMutedColor || "#888" },
                    ]}
                  >
                    Коран
                  </Text>
                </View>
                <View style={styles.mockupTabItem}>
                  <Ionicons
                    name="compass-outline"
                    size={11}
                    color={previewTheme.tabMutedColor || "#888"}
                  />
                  <Text
                    style={[
                      styles.mockupTabLabel,
                      { color: previewTheme.tabMutedColor || "#888" },
                    ]}
                  >
                    Кибла
                  </Text>
                </View>
                <View style={styles.mockupTabItem}>
                  <Ionicons
                    name="map-outline"
                    size={11}
                    color={previewTheme.tabMutedColor || "#888"}
                  />
                  <Text
                    style={[
                      styles.mockupTabLabel,
                      { color: previewTheme.tabMutedColor || "#888" },
                    ]}
                  >
                    Карта
                  </Text>
                </View>
                <View style={styles.mockupTabItem}>
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={11}
                    color={previewTheme.tabMutedColor || "#888"}
                  />
                  <Text
                    style={[
                      styles.mockupTabLabel,
                      { color: previewTheme.tabMutedColor || "#888" },
                    ]}
                  >
                    Ещё
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ================= 2. THEME SELECTION CARDS (6 STYLES) ================= */}
        <View style={styles.themeSectionHeader}>
          <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
            КОЛЛЕКЦИЯ СТИЛЕЙ (6)
          </Text>
          <Text style={[styles.subHint, { color: colors.textSecondary }]}>
            Нажмите для предпросмотра
          </Text>
        </View>

        <View style={styles.themesGrid}>
          {THEMES_META.map((t) => {
            const isSelected = previewThemeId === t.id;
            const isActuallyActive = themeMode === t.id;

            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.themeCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setPreviewThemeId(t.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.themeTitleRow}>
                      <Text
                        style={[
                          styles.themeCardTitle,
                          { color: isSelected ? colors.accent : colors.text },
                        ]}
                      >
                        {t.name}
                      </Text>
                      {isActuallyActive && (
                        <View
                          style={[
                            styles.activeNowBadge,
                            { backgroundColor: colors.accentSoft },
                          ]}
                        >
                          <Text
                            style={[
                              styles.activeNowText,
                              { color: colors.accent },
                            ]}
                          >
                            Активна
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.themeCardDesc,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {t.description}
                    </Text>
                  </View>

                  {/* Radio Checkmark */}
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor: isSelected ? colors.accent : colors.border,
                        backgroundColor: isSelected ? colors.accent : "transparent",
                      },
                    ]}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={colors.textOnActive || "#FFF"}
                      />
                    )}
                  </View>
                </View>

                {/* 4 Swatch Circles */}
                <View style={styles.swatchRow}>
                  {t.swatches.map((colorHex, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.swatchDot,
                        {
                          backgroundColor: colorHex,
                          borderColor:
                            colorHex === "#ffffff" || colorHex === "#FFFFFF"
                              ? "rgba(0,0,0,0.2)"
                              : "rgba(255,255,255,0.2)",
                        },
                      ]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Apply Theme Button */}
        <TouchableOpacity
          style={[
            styles.applyButton,
            {
              backgroundColor: colors.accent,
              shadowColor: colors.accent,
            },
          ]}
          onPress={handleApplyTheme}
          activeOpacity={0.85}
        >
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={colors.textOnActive || "#FFF"}
          />
          <Text
            style={[
              styles.applyButtonText,
              { color: colors.textOnActive || "#FFF" },
            ]}
          >
            {appliedNotice ? "Тема успешно применена!" : "Применить тему"}
          </Text>
        </TouchableOpacity>

        {/* ================= 3. CALCULATION & LOCATION SETTINGS ================= */}
        <View style={[styles.sectionDivider, { borderColor: colors.border }]} />

        <View style={styles.themeSectionHeader}>
          <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
            РАСЧЁТ И МЕСТОПОЛОЖЕНИЕ
          </Text>
        </View>

        <View style={styles.calcGroup}>
          {renderCalculationRow(
            "time-outline",
            "Источник и метод расчёта",
            methodValue,
            () => router.push("/settings/method")
          )}

          {renderCalculationRow(
            "location-outline",
            "Город расписания",
            locationValue,
            () => router.push("/location")
          )}

          {renderCalculationRow(
            "bookmark-outline",
            "Сохранённые города",
            `${savedCities.length} в списке`,
            () => router.push("/location")
          )}

          {renderCalculationRow(
            "locate-outline",
            "Определить местоположение заново",
            locationStatus === "locating" ? "Определяем…" : "По GPS",
            async () => {
              await requestLocationAgain();
              router.push("/");
            }
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 18, paddingBottom: 48 },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  subtitle: { fontSize: 13, marginTop: 4 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  previewControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  themeBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  mockupOuterWrapper: {
    alignItems: "center",
    marginBottom: 20,
  },
  phoneFrame: {
    width: 290,
    height: 480,
    borderRadius: 38,
    borderWidth: 2,
    padding: 6,
    backgroundColor: "#0d131f",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
    overflow: "hidden",
  },
  dynamicIsland: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    width: 76,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#000",
    zIndex: 40,
  },
  mockupScreen: {
    flex: 1,
    borderRadius: 32,
    overflow: "hidden",
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 0,
    position: "relative",
  },
  mockupMainFlow: {
    flex: 1,
    zIndex: 10,
    marginTop: 2,
  },
  mockupBackdropContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  mockupSkyGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    opacity: 0.9,
  },
  mockupStarsRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  starDot: {
    position: "absolute",
    borderRadius: 2,
    backgroundColor: "#FFF",
  },
  mockupCelestial: {
    position: "absolute",
    top: 48,
    right: 14,
    zIndex: 2,
  },
  mockupMosqueWrap: {
    position: "absolute",
    bottom: MOCKUP_MOSQUE_BOTTOM,
    left: 0,
    right: 0,
    height: MOCKUP_MOSQUE_HEIGHT,
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 1,
  },
  mockupStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    zIndex: 10,
    paddingHorizontal: 4,
  },
  mockupStatusTime: {
    fontSize: 9.5,
    fontWeight: "700",
  },
  mockupStatusIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  mockupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 4,
    zIndex: 10,
  },
  mockupLocationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "80%",
  },
  mockupLocationText: {
    fontSize: 11,
    fontWeight: "700",
  },
  mockupDateSection: {
    marginBottom: 6,
    zIndex: 10,
  },
  mockupDateSolar: {
    fontSize: 10,
    fontWeight: "600",
  },
  mockupDateHijri: {
    fontSize: 9,
    marginTop: 1,
    opacity: 0.85,
  },
  mockupHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    zIndex: 10,
  },
  mockupPrayerBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    overflow: "hidden",
  },
  mockupPrayerBadgeImage: {
    width: "100%",
    height: "100%",
    borderRadius: 17,
  },
  mockupPrayerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  mockupPrayerName: {
    fontSize: 11,
    fontWeight: "700",
  },
  mockupSoonPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  mockupSoonText: {
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  mockupPrayerTime: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  mockupScheduleList: {
    gap: 2.5,
    marginBottom: 4,
    zIndex: 10,
  },
  mockupScheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  mockupScheduleRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  mockupIconBox: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  mockupScheduleTitle: {
    fontSize: 9.5,
    fontWeight: "600",
  },
  mockupScheduleTime: {
    fontSize: 10,
    fontWeight: "700",
  },
  mockupTabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 0.5,
    paddingVertical: 5,
    zIndex: 20,
  },
  mockupTabItem: {
    alignItems: "center",
    gap: 1,
  },
  mockupTabLabel: {
    fontSize: 7,
  },
  themeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },
  subHint: {
    fontSize: 11,
  },
  themesGrid: {
    gap: 10,
    marginBottom: 16,
  },
  themeCard: {
    borderRadius: 18,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  themeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  themeCardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  activeNowBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  activeNowText: {
    fontSize: 9.5,
    fontWeight: "700",
  },
  themeCardDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  swatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  swatchDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  sectionDivider: {
    borderTopWidth: 1,
    marginVertical: 12,
  },
  calcGroup: {
    gap: 8,
  },
  calcRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  calcIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  calcRowLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  calcRowValue: {
    fontSize: 11.5,
    marginTop: 2,
  },
});
