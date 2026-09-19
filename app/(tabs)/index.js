import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { useAppData } from "../../utils/AppDataContext";
import LocationHeader from "../../components/LocationHeader";
import NextPrayer from "../../components/NextPrayer";
import PrayerCard from "../../components/PrayerCard";
import SourceBadge from "../../components/SourceBadge";
import SourceInfoToast from "../../components/SourceInfoToast";
import CitySwitcher from "../../components/CitySwitcher";
import { formatDateInTimeZone, todayInTimeZone, getNextPrayer } from "../../utils/time";
import { gregorianToHijri, formatHijriDate } from "../../utils/hijri";

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const {
    status,
    errorMessage,
    city,
    prayerData,
    refreshing,
    refresh,
    requestLocationAgain,
    calcMethod,
    methodOverridden,
    isCitySaved,
    addCity,
    deleteSavedCity,
  } = useAppData();
  const router = useRouter();
  const [sourceToastVisible, setSourceToastVisible] = useState(false);

  // One-time entrance for the date/hijri block so the content flows in
  // gently alongside the PrayerCard stagger cascade.
  const dateEntrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(dateEntrance, {
      toValue: 1,
      duration: 300,
      delay: 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [dateEntrance]);

  // ALL hooks must run on every render — none may sit below the early
  // status returns, otherwise React sees a changing hook order when
  // the status flips (e.g. loading -> ready).
  const cityInList = city ? isCitySaved(city) : false;
  const handleToggleSaved = useCallback(async () => {
    if (!city) return;
    // Chip appears/disappears in CitySwitcher — glide it natively.
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, LayoutAnimation.Types.easeOutEaseIn, LayoutAnimation.Properties.opacity)
    );
    if (isCitySaved(city)) {
      await deleteSavedCity(city); // schedule keeps showing this city
    } else {
      await addCity(city);
    }
  }, [city, isCitySaved, addCity, deleteSavedCity]);

  const openSourceToast = useCallback(() => {
    setSourceToastVisible(true);
  }, []);
  const closeSourceToast = useCallback(() => {
    setSourceToastVisible(false);
  }, []);

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

  // Which prayer row to highlight: the NEXT prayer (Sunrise is not a
  // prayer — it is excluded from "next" and rendered neutral). Same
  // existing utility the NextPrayer hero card uses; display-only.
  const allPrayers = prayerData?.prayers || [];
  const nextPrayer = getNextPrayer(
    allPrayers.filter((p) => p.name !== "Sunrise"),
    tz
  );

  // Hijri date: prefer the value returned together with the schedule
  // (AlAdhan computes it for the city's calendar day); fall back to
  // the local Kuwaiti algorithm. Displayed next to the Gregorian date,
  // day -> month -> year. This is an arithmetical conversion — actual
  // Hijri days start at sunset and follow lunar observation.
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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.cityButton}
            onPress={() => router.push("/location")}
            accessibilityLabel="Открыть экран местоположения"
          >
            <LocationHeader city={city?.name} country={city?.country} />
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            accessibilityLabel="Настройки"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Animated.View
          style={{
            opacity: dateEntrance,
            transform: [
              {
                translateY: dateEntrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          }}
        >
          <View style={styles.dateBlock}>
            <Text style={[styles.date, { color: colors.textSecondary }]}>
              {formatDateInTimeZone(tz)}
            </Text>
            {hijriText ? (
              <Text style={[styles.hijri, { color: colors.textSecondary }]}>{hijriText}</Text>
            ) : null}
          </View>
          {city?.timezone ? (
            <Text style={[styles.tz, { color: colors.textSecondary }]}>{city.timezone}</Text>
          ) : null}
        </Animated.View>

        {/* toggle the current city in the saved list; never re-runs GPS */}
        <TouchableOpacity
          style={[styles.saveCityButton, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={handleToggleSaved}
          disabled={!city}
        >
          <Ionicons
            name={cityInList ? "bookmark" : "bookmark-outline"}
            size={15}
            color={cityInList ? colors.accent : colors.textSecondary}
          />
          <Text
            style={[
              styles.saveCityText,
              { color: cityInList ? colors.accent : colors.textSecondary },
            ]}
          >
            {cityInList ? "Убрать из списка" : "В список городов"}
          </Text>
        </TouchableOpacity>

        <CitySwitcher />

        <NextPrayer prayers={(prayerData?.prayers || []).filter((p) => p.name !== "Sunrise")} timezone={tz} />

        <View style={styles.grid}>
          {allPrayers.map((p, i) => (
            <PrayerCard
              key={p.name}
              name={p.name}
              time={p.time}
              index={i}
              active={Boolean(nextPrayer && nextPrayer.name === p.name)}
            />
          ))}
        </View>

        <SourceBadge
          source={prayerData?.source}
          fromCache={status === "offline-cache"}
          onPress={openSourceToast}
        />

        <View style={styles.sectionButtons}>
          <TouchableOpacity
            style={[styles.sectionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/quran")}
          >
            <Ionicons name="book-outline" size={22} color={colors.accent} />
            <Text style={[styles.sectionText, { color: colors.text }]}>Коран</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sectionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/mosques")}
          >
            <Ionicons name="business-outline" size={22} color={colors.accent} />
            <Text style={[styles.sectionText, { color: colors.text }]}>Мечети</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sectionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/qibla")}
          >
            <Ionicons name="compass-outline" size={22} color={colors.accent} />
            <Text style={[styles.sectionText, { color: colors.text }]}>Кибла</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SourceInfoToast
        visible={sourceToastVisible}
        source={prayerData?.source}
        fromCache={status === "offline-cache"}
        calcMethod={methodOverridden ? calcMethod : null}
        onClose={closeSourceToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cityButton: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  dateBlock: { marginTop: 4 },
  date: { fontSize: 14, textTransform: "capitalize" },
  hijri: { fontSize: 14, marginTop: 2 },
  tz: { fontSize: 12, marginTop: 2 },
  title: { fontSize: 18, fontWeight: "700" },
  muted: { fontSize: 14, lineHeight: 20 },
  button: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  saveCityButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },
  saveCityText: { fontSize: 12, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  sectionButtons: { flexDirection: "row", gap: 10, marginTop: 24 },
  sectionButton: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 18,
  },
  sectionText: { fontSize: 13, fontWeight: "600" },
});
