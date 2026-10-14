import React from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../theme/ThemeContext";
import { useAppData } from "../../utils/AppDataContext";
import NextPrayer from "../../components/NextPrayer";
import PrayerTimesList from "../../components/PrayerTimesList";
import MosqueSilhouette from "../../components/MosqueSilhouette";
import { formatDateInTimeZone, todayInTimeZone, getNextPrayer } from "../../utils/time";
import { gregorianToHijri, formatHijriDate } from "../../utils/hijri";

export default function HomeScreen() {
  const { colors } = useTheme();
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

  const renderBusy = (text) => (
    <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[styles.muted, { color: colors.textSecondary, marginTop: 12 }]}>{text}</Text>
    </SafeAreaView>
  );

  if (status === "loading") {
    return renderBusy("Определяем время намаза…");
  }

  if (status === "need-city") {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: 24 }]}>
        <Text style={[styles.title, { color: colors.text, textAlign: "center" }]}>
          Доступ к геолокации не предоставлен
        </Text>
        <Text
          style={[styles.muted, { color: colors.textSecondary, textAlign: "center", marginTop: 8 }]}
        >
          Выберите город вручную, чтобы увидеть время намаза.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={() => router.push("/location")}
        >
          <Text style={{ color: colors.textOnActive, fontWeight: "700" }}>Выбрать город</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={requestLocationAgain} style={{ marginTop: 14 }}>
          <Text style={{ color: colors.accent, fontWeight: "600" }}>
            Попробовать геолокацию снова
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (status === "error") {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: 24 }]}>
        <Text style={[styles.title, { color: colors.text, textAlign: "center" }]}>
          Что-то пошло не так
        </Text>
        <Text
          style={[styles.muted, { color: colors.textSecondary, textAlign: "center", marginTop: 8 }]}
        >
          {errorMessage}
        </Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={refresh}>
          <Text style={{ color: colors.textOnActive, fontWeight: "700" }}>Повторить</Text>
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Atmospheric Starry Sky, Celestial Body & Mosque Silhouette Backdrop */}
      <MosqueSilhouette />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
      >
        {/* Top Header Bar: 📍 City ⌵ on left, ⚙ on right */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.citySelector}
            onPress={() => router.push("/location")}
            activeOpacity={0.7}
            accessibilityLabel="Сменить город"
          >
            <Ionicons name="location-sharp" size={17} color={colors.accent} />
            <Text style={[styles.cityName, { color: colors.text }]} numberOfLines={1}>
              {city?.name || "Выберите город"}
            </Text>
            <Ionicons name="chevron-down" size={15} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/settings")}
            accessibilityLabel="Настройки"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ zIndex: 10 }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Date & Hijri Calendar Block */}
        <View style={styles.dateSection}>
          <Text style={[styles.gregorianDate, { color: colors.text }]}>
            Сегодня, {formatDateInTimeZone(tz)}
          </Text>
          {hijriText ? (
            <Text
              style={[
                styles.hijriDate,
                { color: colors.hijriColor || colors.textSecondary },
              ]}
            >
              {hijriText}
            </Text>
          ) : null}
        </View>

        {/* Hero Next Prayer Card (matching Settings preview) */}
        <NextPrayer
          prayers={allPrayers.filter((p) => p.name !== "Sunrise")}
          timezone={tz}
        />

        {/* Vertical Prayer Times List */}
        <PrayerTimesList
          prayers={allPrayers}
          nextPrayer={nextPrayer}
          timezone={tz}
        />

        {/* Monthly Table Button */}
        <TouchableOpacity
          style={[styles.monthlyButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            const now = Date.now();
            if (now - (global.lastMonthlyNav || 0) > 1000) {
              global.lastMonthlyNav = now;
              router.push("/monthly");
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.accent} />
          <Text style={[styles.monthlyButtonText, { color: colors.text }]}>Таблица на месяц</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    position: "relative",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 6,
  },
  citySelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "80%",
  },
  cityName: {
    fontSize: 18,
    fontWeight: "800",
  },
  dateSection: {
    marginTop: 2,
    marginBottom: 10,
  },
  gregorianDate: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  hijriDate: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.85,
  },
  title: { fontSize: 18, fontWeight: "700" },
  muted: { fontSize: 14, lineHeight: 20 },
  button: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  monthlyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  monthlyButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
