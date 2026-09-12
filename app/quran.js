import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../theme/ThemeContext";
import { fetchSurahList } from "../services/quranApi";

// Surah list. Text comes only from the verified AlQuran Cloud API —
// on failure the screen shows an honest error, never a placeholder.
export default function QuranScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();

  const [surahs, setSurahs] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSurahList();
      setSurahs(list);
    } catch (e) {
      setError(
        e.message === "NETWORK_ERROR"
          ? "Нет подключения к интернету. Не удалось загрузить список сур."
          : "Не удалось загрузить Коран."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (surahs || []).filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      String(s.number) === q ||
      s.englishName.toLowerCase().includes(q) ||
      (s.englishNameTranslation || "").toLowerCase().includes(q) ||
      (s.name || "").includes(query.trim())
    );
  });

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.surahRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/surah/${item.number}`)}
    >
      <View style={[styles.numberBadge, { backgroundColor: colors.accentSoft }]}>
        <Text style={[styles.numberText, { color: colors.accent }]}>{item.number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.englishName, { color: colors.text }]} numberOfLines={1}>
          {item.englishName}
        </Text>
        <Text style={[styles.translation, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.englishNameTranslation} · {item.numberOfAyahs} аятов
        </Text>
      </View>
      <Text style={[styles.arabicName, { color: colors.text }]} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  // Back guard: never trigger an unhandled GO_BACK; fall back to Home.
  const goBackToHome = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackToHome} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Коран</Text>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Номер или название суры…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>

      {loading && !surahs ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.muted, { color: colors.textSecondary, marginTop: 12 }]}>
            Загружаем список сур…
          </Text>
        </View>
      ) : error ? (
        <View style={[styles.center, { flex: 1, paddingHorizontal: 32 }]}>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text, textAlign: "center" }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={load}
          >
            <Text style={{ color: colors.textOnActive, fontWeight: "700" }}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => String(s.number)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 20 }}>
              Ничего не найдено
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: "800" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
  center: { alignItems: "center", justifyContent: "center" },
  muted: { fontSize: 14 },
  errorText: { fontSize: 15, lineHeight: 21, marginTop: 8, textAlign: "center" },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  surahRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  numberBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontSize: 15, fontWeight: "800" },
  englishName: { fontSize: 15, fontWeight: "700" },
  translation: { fontSize: 12, marginTop: 2 },
  arabicName: { fontSize: 17, maxWidth: 110 },
});
