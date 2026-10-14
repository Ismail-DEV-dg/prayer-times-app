import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeContext";
import { useAppData } from "../utils/AppDataContext";
import { fetchMonthlyCalendar } from "../services/prayerApi";

const PRAYER_NAMES_RU = {
  Fajr: "Фаджр",
  Sunrise: "Восход",
  Dhuhr: "Зухр",
  Asr: "Аср",
  Maghrib: "Магриб",
  Isha: "Иша",
};

// Compact headers for the table
const PRAYER_HEADERS = ["Фдж", "Всх", "Зхр", "Аср", "Мгр", "Иша"];

export default function MonthlyScreen() {
  const { colors } = useTheme();
  const { city, calcMethod, methodOverridden, adjustments, extraPrayers } = useAppData();
  const router = useRouter();

  const [monthData, setMonthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    if (!city) return;
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const data = await fetchMonthlyCalendar({
        latitude: city.latitude,
        longitude: city.longitude,
        method: methodOverridden ? calcMethod : null,
        country: city.country,
        name: city.name,
        region: city.region,
        timezone: city.timezone,
        month,
        year,
      });
      setMonthData(data);
    } catch (e) {
      setError("Не удалось загрузить расписание на месяц. Проверьте подключение к интернету.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [city]);

  function timeToMins(t) {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function minsToTime(mins) {
    let h = Math.floor(mins / 60) % 24;
    if (h < 0) h += 24;
    let m = mins % 60;
    if (m < 0) m += 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const adjustedMonthData = React.useMemo(() => {
    if (!monthData) return null;
    return monthData.map((dayItem) => {
      let newPrayers = dayItem.prayers.map((p) => {
        const offset = adjustments[p.name] || 0;
        if (offset === 0 || !p.time) return p;
        return { ...p, time: minsToTime(timeToMins(p.time) + offset) };
      });

      if (extraPrayers.tahajjud || extraPrayers.duha) {
        const fajr = newPrayers.find(p => p.name === "Fajr")?.time;
        const sunrise = newPrayers.find(p => p.name === "Sunrise")?.time;
        const maghrib = newPrayers.find(p => p.name === "Maghrib")?.time;
        const isha = newPrayers.find(p => p.name === "Isha")?.time;

        if (extraPrayers.duha && sunrise) {
          const duhaMins = timeToMins(sunrise) + 20;
          const duhaObj = { name: "Duha", time: minsToTime(duhaMins) };
          const sunriseIndex = newPrayers.findIndex(p => p.name === "Sunrise");
          if (sunriseIndex !== -1) {
            newPrayers.splice(sunriseIndex + 1, 0, duhaObj);
          } else {
            newPrayers.push(duhaObj);
          }
        }

        if (extraPrayers.tahajjud && fajr && maghrib && isha) {
          const fajrMins = timeToMins(fajr);
          const maghribMins = timeToMins(maghrib);
          const nightMins = (24 * 60 - maghribMins) + fajrMins;

          const tMins = Math.floor(maghribMins + nightMins * (2/3));
          newPrayers.push({ name: "Tahajjud", time: minsToTime(tMins) });
        }
      }
      return { ...dayItem, prayers: newPrayers };
    });
  }, [monthData, adjustments, extraPrayers]);

  // Dynamically generate headers based on the first day's prayers
  const dynamicHeaders = React.useMemo(() => {
    if (!adjustedMonthData || adjustedMonthData.length === 0) return PRAYER_HEADERS;
    const names = { Fajr: "Фдж", Sunrise: "Всх", Dhuhr: "Зхр", Asr: "Аср", Maghrib: "Мгр", Isha: "Иша", Tahajjud: "Тхдж", Duha: "Духа" };
    return adjustedMonthData[0].prayers.map(p => names[p.name] || p.name.substring(0,3));
  }, [adjustedMonthData]);

  const renderHeader = () => (
    <View style={[styles.tableRow, styles.tableHeaderRow, { backgroundColor: colors.accentSoft }]}>
      <Text style={[styles.cellDay, styles.headerText, { color: colors.accent }]}>День</Text>
      {dynamicHeaders.map((h, i) => (
        <Text key={i} style={[styles.cellTime, styles.headerText, { color: colors.accent }]}>
          {h}
        </Text>
      ))}
    </View>
  );

  const renderItem = ({ item }) => {
    const isToday = item.date === `${String(new Date().getDate()).padStart(2, "0")}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${new Date().getFullYear()}`;
    return (
      <View
        style={[
          styles.tableRow,
          { 
            backgroundColor: isToday ? colors.accentSoft : colors.card,
            borderBottomColor: colors.border 
          },
        ]}
      >
        <Text style={[styles.cellDay, { color: isToday ? colors.accent : colors.text, fontWeight: isToday ? "700" : "500" }]}>
          {item.day}
        </Text>
        {item.prayers.map((p, i) => (
          <Text key={i} style={[styles.cellTime, { color: isToday ? colors.accent : colors.text, fontWeight: isToday ? "700" : "400" }]} numberOfLines={1}>
            {p.time}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Расписание на месяц</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {city?.name}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>Загрузка таблицы…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
          <Text style={[styles.centerText, { color: colors.text, marginVertical: 12, textAlign: "center" }]}>
            {error}
          </Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.accent }]} onPress={loadData}>
            <Text style={{ color: colors.textOnActive, fontWeight: "700" }}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.tableContainer}>
          {renderHeader()}
          <FlatList
            data={adjustedMonthData}
            keyExtractor={(item) => item.date}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { fontSize: 15, marginTop: 10 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  tableContainer: {
    flex: 1,
    marginTop: 10,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  tableHeaderRow: {
    borderBottomWidth: 0,
    paddingVertical: 14,
  },
  headerText: {
    fontWeight: "700",
    fontSize: 13,
  },
  cellDay: {
    width: 36, // fixed width for day number
    fontSize: 15,
  },
  cellTime: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
  },
});
