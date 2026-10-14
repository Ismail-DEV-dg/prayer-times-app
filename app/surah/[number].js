import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { colors, radii, fonts } from "../../theme/theme";
import {
  fetchSurah,
  getAyahAudioUrl,
  getAyahAudioUrlFallback,
  RECITERS,
  DEFAULT_RECITER,
  normalizeReciterId,
} from "../../services/quranApi";
import { useAyahAudio } from "../../hooks/useAyahAudio";
import { useAppData } from "../../utils/AppDataContext";
import { getReciter, saveReciter } from "../../utils/storage";

// One surah: a simple vertical list of ayahs. Every ayah is an
// interactive item with per-ayah audio (exact Surah X / Ayah N via
// the global ayah number). One audio player at a time.
export default function SurahScreen() {
  const { colors: _themeColors } = useAppTheme();
  const { selectedCity } = useAppData();
  const router = useRouter();
  const { number } = useLocalSearchParams();
  const surahNumber = Number(number);

  const mountedRef = useRef(true);
  const [surah, setSurah] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reciter, setReciter] = useState(DEFAULT_RECITER);

  const audio = useAyahAudio();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Back guard: never trigger an unhandled GO_BACK; fall back to the
  // surah list (Home would lose the Quran context).
  const goBackSafely = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/quran");
    }
  };

  const load = useCallback(async (reciterId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSurah(surahNumber, selectedCity);
      if (mountedRef.current) {
        setSurah(data);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(
          e.message === "NETWORK_ERROR"
            ? "Нет подключения к интернету. Не удалось загрузить суру."
            : "Не удалось загрузить Коран."
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [surahNumber, selectedCity]);

  useEffect(() => {
    (async () => {
      const saved = await getReciter();
      const id = normalizeReciterId(saved);
      setReciter(id);
      load(id);
    })();
  }, [load]);

  const changeReciter = async (id) => {
    await audio.stop();
    const validId = normalizeReciterId(id);
    setReciter(validId);
    await saveReciter(validId);
  };

  const playAyah = (ayah, forceRestart = false) => {
    const key = `${surahNumber}/${ayah.numberInSurah}`;
    const activeReciter = normalizeReciterId(reciter);
    const primary = getAyahAudioUrl(surahNumber, ayah.numberInSurah, activeReciter, ayah.globalNumber, selectedCity);
    const fallback = getAyahAudioUrlFallback(ayah.globalNumber, activeReciter);
    audio.play(primary, key, fallback, forceRestart).catch(() => {});
  };

  const renderAyah = ({ item }) => {
    const key = `${surahNumber}/${item.numberInSurah}`;
    const isPlaying = audio.playingKey === key && !audio.paused;
    const isPaused = audio.playingKey === key && audio.paused;
    const isLoading = audio.loadingKey === key;
    const hasError = audio.errorKey === key;
    const isActive = isPlaying || isPaused;

    return (
      <TouchableOpacity
        style={[styles.ayahCard, isActive && styles.ayahCardActive]}
        onPress={() => playAyah(item, true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Аят ${item.numberInSurah}`}
      >
        <View style={styles.ayahTopRow}>
          {/* Pill with ayah number */}
          <View style={styles.numberPill}>
            <Text style={styles.numberPillText}>{item.numberInSurah}</Text>
          </View>

          {/* Audio controls */}
          <View style={styles.audioControls}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : hasError ? (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={10} />
                <Path d="M12 8v4M12 16h.01" />
              </Svg>
            ) : isActive ? (
              <View style={styles.activeAudioControls}>
                <TouchableOpacity
                  style={styles.iconTouchBtn}
                  onPress={() => audio.toggleLoop()}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Повтор аята"
                  accessibilityRole="button"
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={audio.isLooping ? colors.accent : colors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="m17 2 4 4-4 4" />
                    <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <Path d="m7 22-4-4 4-4" />
                    <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </Svg>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconTouchBtn}
                  onPress={() => playAyah(item, false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={isPlaying ? "Пауза" : "Воспроизвести"}
                  accessibilityRole="button"
                >
                  {isPlaying ? (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill={colors.accent} stroke={colors.accent} strokeWidth={1.5}>
                      <Rect x="6" y="4" width="4" height="16" rx="1" />
                      <Rect x="14" y="4" width="4" height="16" rx="1" />
                    </Svg>
                  ) : (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill={colors.accent} stroke={colors.accent} strokeWidth={1.5}>
                      <Path d="m6 4 14 8-14 8V4z" />
                    </Svg>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.iconTouchBtn}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M4 15v-3a8 8 0 0 1 16 0v3" />
                  <Rect x="3" y="14" width="4" height="7" rx="2" />
                  <Rect x="17" y="14" width="4" height="7" rx="2" />
                </Svg>
              </View>
            )}
          </View>
        </View>

        {/* Arabic text */}
        <Text style={styles.arabic} selectable>
          {item.arabic}
        </Text>

        {/* Translation */}
        {item.translation ? (
          <Text style={styles.translation} selectable>
            {item.translation}
          </Text>
        ) : null}

        {hasError && (
          <Text style={styles.audioErrorText}>
            Не удалось загрузить аудио. Источники недоступны.
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !surah) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Загружаем суру…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goBackSafely}
            activeOpacity={0.7}
            accessibilityLabel="Назад"
            accessibilityRole="button"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 19l-7-7 7-7" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.titleLatin}>Сура {surahNumber}</Text>
        </View>
        <View style={styles.errorCenter}>
          <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-15.08 3.52M2 2l20 20M6.3 6.3a8 8 0 0 0-4.56 7.22 5 5 0 0 0 5 5h11.44" />
          </Svg>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => load(reciter)}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={goBackSafely}
          activeOpacity={0.7}
          accessibilityLabel="Назад"
          accessibilityRole="button"
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 19l-7-7 7-7" />
          </Svg>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text numberOfLines={1}>
            <Text style={styles.titleLatin}>{surah.englishName}</Text>
            <Text style={styles.titleArabic}> · {surah.name}</Text>
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {surah.englishNameTranslation} · {surah.numberOfAyahs} аятов
          </Text>
        </View>

        <View style={styles.translationBlock}>
          <Text style={styles.translationLabel}>ПЕРЕВОД</Text>
          <Text style={styles.translatorName}>Э. Кулиев</Text>
        </View>
      </View>

      {/* Reciter Chips Horizontal Scroll */}
      <View style={styles.reciterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reciterScrollContent}
        >
          {RECITERS.map((r) => {
            const active = reciter === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.reciterChip,
                  active && styles.reciterChipActive,
                ]}
                onPress={() => changeReciter(r.id)}
                hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Чтец ${r.name}`}
              >
                <Text
                  style={[
                    styles.reciterChipText,
                    active && styles.reciterChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {r.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={surah.ayahs}
        keyExtractor={(a) => String(a.numberInSurah)}
        contentContainerStyle={styles.ayahListContent}
        showsVerticalScrollIndicator={false}
        renderItem={renderAyah}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg, // #0D1613
  },
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.button, // 14
    borderWidth: 1,
    borderColor: colors.border, // #243630
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerTitleWrap: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  titleLatin: {
    fontFamily: fonts.ui.bold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text, // #EDE6D6
  },
  titleArabic: {
    fontFamily: fonts.arabic.bold,
    fontSize: 22,
    lineHeight: 32,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted, // #8FA89E
  },
  translationBlock: {
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0,
    gap: 2,
  },
  translationLabel: {
    fontFamily: fonts.ui.semibold,
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.accent, // #E3BE72
  },
  translatorName: {
    fontFamily: fonts.ui.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.text, // #EDE6D6
  },
  reciterRow: {
    paddingBottom: 12,
  },
  reciterScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  reciterChip: {
    height: 40,
    borderRadius: radii.pill, // 999
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderStrong, // #2C4238
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  reciterChipActive: {
    backgroundColor: colors.surfaceActive, // #1B2F28
    borderColor: colors.accent, // #E3BE72
  },
  reciterChipText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted, // #8FA89E
    maxWidth: 160,
  },
  reciterChipTextActive: {
    color: colors.accent, // #E3BE72
  },
  ayahListContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 12,
  },
  ayahCard: {
    backgroundColor: colors.surface, // #15241F
    borderWidth: 1,
    borderColor: colors.border, // #243630
    borderRadius: radii.card, // 22
    padding: 16,
  },
  ayahCardActive: {
    backgroundColor: colors.surfaceActive, // #1B2F28
    borderColor: colors.accent, // #E3BE72
  },
  ayahTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  numberPill: {
    borderRadius: radii.pill, // 999
    minWidth: 36,
    height: 28,
    backgroundColor: colors.bg, // #0D1613
    borderWidth: 1,
    borderColor: colors.borderStrong, // #2C4238
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  numberPillText: {
    fontFamily: fonts.ui.bold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.accent, // #E3BE72
    fontVariant: ["tabular-nums"],
  },
  audioControls: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  activeAudioControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconTouchBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arabic: {
    fontFamily: fonts.arabic.bold,
    fontSize: 30,
    lineHeight: 56,
    color: colors.text, // #EDE6D6
    textAlign: "right",
    writingDirection: "rtl",
  },
  translation: {
    fontFamily: fonts.ui.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textDim, // #C9C2B2
    textAlign: "left",
    marginTop: 12,
  },
  audioErrorText: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accent,
    marginTop: 8,
  },
  center: {
    flex: 1,
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
  errorCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
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
});
