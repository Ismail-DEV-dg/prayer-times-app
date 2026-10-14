import React, { useEffect, useState, useCallback, useRef } from "react";
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
import { StatusBar } from "expo-status-bar";
import Svg, { Path, Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import { colors, radii, fonts } from "../theme/theme";
import { useAppData } from "../utils/AppDataContext";
import { fetchSurahList } from "../services/quranApi";
import SectionHeader from "../components/ui/SectionHeader";

// Surah list for the READ mode. Text comes from verified sources (primary + fallback).
// On failure an honest error is shown.
export default function ReadScreen() {
  const { selectedCity } = useAppData();
  const router = useRouter();

  const mountedRef = useRef(true);
  const [surahs, setSurahs] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSurahNumber, setActiveSurahNumber] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSurahList(selectedCity);
      if (mountedRef.current) {
        setSurahs(list);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(
          e.message === "NETWORK_ERROR"
            ? "Нет подключения к интернету. Не удалось загрузить список сур."
            : "Не удалось загрузить Коран."
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [selectedCity]);

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

  // Back guard: never trigger an unhandled GO_BACK; fall back to Quran.
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/quran");
    }
  };

  const renderItem = ({ item }) => {
    const isActive = activeSurahNumber === item.number;

    return (
      <TouchableOpacity
        style={[styles.surahRow, isActive && styles.surahRowActive]}
        onPress={() => router.push(`/surah/${item.number}`)}
        onPressIn={() => setActiveSurahNumber(item.number)}
        onPressOut={() => setActiveSurahNumber(null)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${item.number}. ${item.englishName}, ${item.numberOfAyahs} аятов`}
      >
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{item.number}</Text>
        </View>

        <View style={styles.middleCol}>
          <Text style={styles.englishName} numberOfLines={1}>
            {item.englishName}
          </Text>
          <Text style={styles.translation} numberOfLines={1}>
            {item.englishNameTranslation} · {item.numberOfAyahs} аятов
          </Text>
        </View>

        <Text style={styles.arabicName} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.headerWrap}>
        <SectionHeader
          title="Читать"
          fontSize={24}
          lineHeight={32}
          onBackPress={goBack}
        />
      </View>

      {/* Search Input */}
      <View
        style={[
          styles.searchWrap,
          isSearchFocused && styles.searchWrapFocused,
        ]}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={11} cy={11} r={8} />
          <Path d="m21 21-4.3-4.3" />
        </Svg>
        <TextInput
          style={styles.searchInput}
          placeholder="Номер или название суры…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          cursorColor={colors.accent}
          selectionColor={colors.accent}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Очистить поиск"
            accessibilityRole="button"
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={12} r={9} />
              <Path d="m15 9-6 6M9 9l6 6" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      {loading && !surahs ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Загружаем список сур…</Text>
        </View>
      ) : error ? (
        <View style={[styles.center, { flex: 1, paddingHorizontal: 32 }]}>
          <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-15.08 3.52M2 2l20 20M6.3 6.3a8 8 0 0 0-4.56 7.22 5 5 0 0 0 5 5h11.44" />
          </Svg>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={load}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => String(s.number)}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Ничего не найдено</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg, // #0D1613
  },
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  searchWrap: {
    height: 52,
    borderRadius: radii.row, // 18
    backgroundColor: colors.surface, // #15241F
    borderWidth: 1,
    borderColor: colors.border, // #243630
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchWrapFocused: {
    borderColor: colors.accent, // #E3BE72
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.ui.regular,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text, // #EDE6D6
    paddingVertical: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 8,
  },
  surahRow: {
    height: 76,
    borderRadius: radii.row, // 18
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderSoft, // #1E2E28
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  surahRowActive: {
    backgroundColor: colors.surfaceActive, // #1B2F28
    borderColor: colors.accent, // #E3BE72
  },
  numberBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.iconBox, // 12
    backgroundColor: colors.surfaceActive, // #1B2F28
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  numberText: {
    fontFamily: fonts.ui.bold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.accent, // #E3BE72
    fontVariant: ["tabular-nums"],
  },
  middleCol: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
    marginRight: 8,
  },
  englishName: {
    fontFamily: fonts.ui.semibold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text, // #EDE6D6
  },
  translation: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted, // #8FA89E
  },
  arabicName: {
    fontFamily: fonts.arabic.bold,
    fontSize: 24,
    lineHeight: 40,
    color: colors.text, // #EDE6D6
    textAlign: "right",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 12,
  },
  errorText: {
    fontFamily: fonts.ui.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    textAlign: "center",
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    height: 44,
    borderRadius: radii.button,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    fontFamily: fonts.ui.bold,
    fontSize: 15,
    color: colors.onAccent,
  },
  emptyText: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
    marginTop: 24,
  },
});
