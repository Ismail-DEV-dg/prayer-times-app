import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
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
  fetchAyahTafsir,
  RECITERS,
  DEFAULT_RECITER,
  normalizeReciterId,
} from "../../services/quranApi";
import { useAyahAudio } from "../../hooks/useAyahAudio";
import { useAppData } from "../../utils/AppDataContext";
import {
  getReciter,
  saveReciter,
  getSavedReadingTheme,
  saveReadingTheme,
} from "../../utils/storage";

const DARK_READING_THEME = {
  isLight: false,
  statusBarStyle: "light",
  bg: colors.bg, // #0D1613
  surface: colors.surface, // #15241F
  surfaceActive: colors.surfaceActive, // #1B2F28
  border: colors.border, // #243630
  borderSoft: colors.borderSoft, // #1E2E28
  borderStrong: colors.borderStrong, // #2C4238
  text: colors.text, // #EDE6D6
  textDim: colors.textDim, // #C9C2B2
  muted: colors.muted, // #8FA89E
  accent: colors.accent, // #E3BE72
  onAccent: colors.onAccent, // #0D1613
  cardBg: colors.surface, // #15241F
  cardActiveBg: colors.surfaceActive, // #1B2F28
  numberPillBg: colors.bg, // #0D1613
  sheetBg: colors.surface, // #15241F
  sheetBackdrop: "rgba(0, 0, 0, 0.55)",
};

const LIGHT_READING_THEME = {
  isLight: true,
  statusBarStyle: "dark",
  bg: "#F8F6F0", // мягкий книжный фон
  surface: "#FFFFFF", // чистый белый фон карточек
  surfaceActive: "#FAF6EE", // мягкий золотистый оттенок активной карточки/чипа
  border: "#E8E2D6", // аккуратная бумажная рамка
  borderSoft: "#EDE8DF",
  borderStrong: "#DCD4C4",
  text: "#1C2421", // глубокий темный цвет для текста (WCAG AAA)
  textDim: "#2C3B35", // цвет русского перевода
  muted: "#72847D", // подписи, счетчики
  accent: "#A87C28", // благородное золото для светлого фона
  onAccent: "#FFFFFF",
  cardBg: "#FFFFFF",
  cardActiveBg: "#FAF6EE",
  numberPillBg: "#F4EFE4",
  sheetBg: "#FFFFFF",
  sheetBackdrop: "rgba(0, 0, 0, 0.4)",
};

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
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSavedReadingTheme().then((saved) => {
      if (mounted && saved === "light") {
        setIsLightMode(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleTheme = () => {
    setIsLightMode((prev) => {
      const next = !prev;
      saveReadingTheme(next ? "light" : "dark");
      return next;
    });
  };

  const tColors = isLightMode ? LIGHT_READING_THEME : DARK_READING_THEME;

  const audio = useAyahAudio();

  // Tafsir in-memory cache and state
  const tafsirCacheRef = useRef(new Map());
  const activeTafsirRequestIdRef = useRef(0);
  const tafsirAbortRef = useRef(null);

  const [activeTafsir, setActiveTafsir] = useState(null); // { ayahNumber: number, resourceId: number } | null
  const [tafsirModalVisible, setTafsirModalVisible] = useState(false);
  const [tafsirLoading, setTafsirLoading] = useState(false);
  const [tafsirError, setTafsirError] = useState(false);
  const [tafsirText, setTafsirText] = useState("");

  const closeTafsir = useCallback(() => {
    activeTafsirRequestIdRef.current++;
    if (tafsirAbortRef.current) {
      tafsirAbortRef.current.abort();
      tafsirAbortRef.current = null;
    }
    setTafsirModalVisible(false);
    setActiveTafsir(null);
  }, []);

  const loadTafsirData = useCallback(async (ayahNumber, resourceId) => {
    const cacheKey = `${resourceId}:${surahNumber}:${ayahNumber}`;
    if (tafsirCacheRef.current.has(cacheKey)) {
      setTafsirText(tafsirCacheRef.current.get(cacheKey));
      setTafsirLoading(false);
      setTafsirError(false);
      return;
    }

    setTafsirLoading(true);
    setTafsirError(false);
    setTafsirText("");

    if (tafsirAbortRef.current) {
      tafsirAbortRef.current.abort();
    }
    const abortController = new AbortController();
    tafsirAbortRef.current = abortController;
    const currentRequestId = ++activeTafsirRequestIdRef.current;

    try {
      const text = await fetchAyahTafsir(resourceId, surahNumber, ayahNumber, abortController.signal);
      if (activeTafsirRequestIdRef.current !== currentRequestId) return;
      tafsirCacheRef.current.set(cacheKey, text);
      setTafsirText(text);
      setTafsirLoading(false);
    } catch (e) {
      if (activeTafsirRequestIdRef.current !== currentRequestId || e.message === "ABORTED") return;
      setTafsirError(true);
      setTafsirLoading(false);
    }
  }, [surahNumber]);

  const openTafsir = useCallback((ayahNumber, resourceId) => {
    setActiveTafsir({ ayahNumber, resourceId });
    setTafsirModalVisible(true);
    loadTafsirData(ayahNumber, resourceId);
  }, [loadTafsirData]);

  const retryTafsir = useCallback(() => {
    if (activeTafsir) {
      loadTafsirData(activeTafsir.ayahNumber, activeTafsir.resourceId);
    }
  }, [activeTafsir, loadTafsirData]);

  const renderTafsirParagraph = (paragraph, index) => {
    const segments = paragraph.split(/([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]*[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+|[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])/g);

    return (
      <Text
        key={index}
        style={[styles.tafsirParagraph, isLightMode && { color: tColors.textDim }]}
        selectable
      >
        {segments.map((seg, sIdx) => {
          if (!seg) return null;
          const isArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(seg);
          if (isArabic) {
            return (
              <Text
                key={sIdx}
                style={[styles.tafsirArabicQuote, isLightMode && { color: tColors.text }]}
              >
                {seg}
              </Text>
            );
          }
          return <React.Fragment key={sIdx}>{seg}</React.Fragment>;
        })}
      </Text>
    );
  };

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

  const playAyah = useCallback(
    (ayah, forceRestart = false) => {
      const key = `${surahNumber}/${ayah.numberInSurah}`;
      const activeReciter = normalizeReciterId(reciter);
      const primary = getAyahAudioUrl(surahNumber, ayah.numberInSurah, activeReciter, ayah.globalNumber, selectedCity);
      const fallback = getAyahAudioUrlFallback(ayah.globalNumber, activeReciter);
      audio.play(primary, key, fallback, forceRestart).catch(() => {});
    },
    [surahNumber, reciter, selectedCity, audio]
  );

  const renderAyah = useCallback(
    ({ item }) => {
      const key = `${surahNumber}/${item.numberInSurah}`;
      const isPlaying = audio.playingKey === key && !audio.paused;
      const isPaused = audio.playingKey === key && audio.paused;
      const isLoading = audio.loadingKey === key;
      const hasError = audio.errorKey === key;
      const isActive = isPlaying || isPaused;
      const isTafsirActive = tafsirModalVisible && activeTafsir?.ayahNumber === item.numberInSurah;

    return (
      <TouchableOpacity
        style={[
          styles.ayahCard,
          isLightMode && {
            backgroundColor: tColors.cardBg,
            borderColor: tColors.border,
          },
          isActive && (isLightMode ? {
            backgroundColor: tColors.cardActiveBg,
            borderColor: tColors.accent,
          } : styles.ayahCardActive),
        ]}
        onPress={() => playAyah(item, true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Аят ${item.numberInSurah}`}
      >
        <View style={styles.ayahTopRow}>
          {/* Pill with ayah number */}
          <View
            style={[
              styles.numberPill,
              isLightMode && {
                backgroundColor: tColors.numberPillBg,
                borderColor: tColors.borderStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.numberPillText,
                isLightMode && { color: tColors.accent },
              ]}
            >
              {item.numberInSurah}
            </Text>
          </View>

          {/* Audio controls */}
          <View style={styles.audioControls}>
            {isLoading ? (
              <ActivityIndicator size="small" color={tColors.accent} />
            ) : hasError ? (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tColors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={audio.isLooping ? tColors.accent : tColors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill={tColors.accent} stroke={tColors.accent} strokeWidth={1.5}>
                      <Rect x="6" y="4" width="4" height="16" rx="1" />
                      <Rect x="14" y="4" width="4" height="16" rx="1" />
                    </Svg>
                  ) : (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill={tColors.accent} stroke={tColors.accent} strokeWidth={1.5}>
                      <Path d="m6 4 14 8-14 8V4z" />
                    </Svg>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.iconTouchBtn}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={tColors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M4 15v-3a8 8 0 0 1 16 0v3" />
                  <Rect x="3" y="14" width="4" height="7" rx="2" />
                  <Rect x="17" y="14" width="4" height="7" rx="2" />
                </Svg>
              </View>
            )}
          </View>
        </View>

        {/* Arabic text */}
        <Text
          style={[
            styles.arabic,
            isLightMode && { color: tColors.text },
          ]}
          selectable
        >
          {item.arabic}
        </Text>

        {/* Translation */}
        {item.translation ? (
          <Text
            style={[
              styles.translation,
              isLightMode && { color: tColors.textDim },
            ]}
            selectable
          >
            {item.translation}
          </Text>
        ) : null}

        {/* Tafsir Button */}
        <View style={styles.tafsirButtonsRow}>
          <TouchableOpacity
            style={[
              styles.tafsirBtn,
              isLightMode && { borderColor: tColors.accent },
              isTafsirActive && (isLightMode ? { backgroundColor: tColors.surfaceActive } : styles.tafsirBtnActive),
            ]}
            onPress={() => openTafsir(item.numberInSurah, 170)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Тафсир ас-Саади, аят ${item.numberInSurah}`}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={tColors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <Path d="M6 6h10" />
              <Path d="M6 10h10" />
            </Svg>
            <Text style={[styles.tafsirBtnText, isLightMode && { color: tColors.accent }]}>Ас-Саади</Text>
          </TouchableOpacity>
        </View>

        {hasError && (
          <Text style={[styles.audioErrorText, isLightMode && { color: tColors.accent }]}>
            Не удалось загрузить аудио. Источники недоступны.
          </Text>
        )}
      </TouchableOpacity>
    );
  }, [surahNumber, audio, playAyah, tafsirModalVisible, activeTafsir, openTafsir, isLightMode, tColors]);

  if (loading && !surah) {
    return (
      <SafeAreaView style={[styles.safe, isLightMode && { backgroundColor: tColors.bg }]} edges={["top"]}>
        <StatusBar style={tColors.statusBarStyle} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={tColors.accent} />
          <Text style={[styles.loadingText, isLightMode && { color: tColors.muted }]}>Загружаем суру…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, isLightMode && { backgroundColor: tColors.bg }]} edges={["top"]}>
        <StatusBar style={tColors.statusBarStyle} />
        <View style={[styles.header, isLightMode && { backgroundColor: tColors.bg }]}>
          <TouchableOpacity
            style={[styles.backBtn, isLightMode && { borderColor: tColors.border, backgroundColor: tColors.surface }]}
            onPress={goBackSafely}
            activeOpacity={0.7}
            accessibilityLabel="Назад"
            accessibilityRole="button"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={tColors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 19l-7-7 7-7" />
            </Svg>
          </TouchableOpacity>
          <Text style={[styles.titleLatin, isLightMode && { color: tColors.text }]}>Сура {surahNumber}</Text>
        </View>
        <View style={styles.errorCenter}>
          <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={tColors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-15.08 3.52M2 2l20 20M6.3 6.3a8 8 0 0 0-4.56 7.22 5 5 0 0 0 5 5h11.44" />
          </Svg>
          <Text style={[styles.errorText, isLightMode && { color: tColors.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, isLightMode && { backgroundColor: tColors.accent }]}
            onPress={() => load(reciter)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Повторить"
          >
            <Text style={[styles.retryButtonText, isLightMode && { color: tColors.onAccent }]}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, isLightMode && { backgroundColor: tColors.bg }]} edges={["top"]}>
      <StatusBar style={tColors.statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, isLightMode && { backgroundColor: tColors.bg }]}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            isLightMode && { borderColor: tColors.border, backgroundColor: tColors.surface },
          ]}
          onPress={goBackSafely}
          activeOpacity={0.7}
          accessibilityLabel="Назад"
          accessibilityRole="button"
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={tColors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 19l-7-7 7-7" />
          </Svg>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitleLine} numberOfLines={1}>
            <Text style={[styles.titleLatin, isLightMode && { color: tColors.text }]}>{surah.englishName}</Text>
            <Text style={[styles.titleArabic, isLightMode && { color: tColors.text }]}> · {surah.name}</Text>
          </Text>
          <Text style={[styles.subtitle, isLightMode && { color: tColors.muted }]} numberOfLines={1}>
            {surah.englishNameTranslation} · {surah.numberOfAyahs} аятов
          </Text>
        </View>

        {/* Right Header Area: Theme Toggle (crescent/sun) + Translation block */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.themeToggleBtn,
              isLightMode && {
                borderColor: tColors.border,
                backgroundColor: tColors.surfaceActive,
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={isLightMode ? "Включить тёмную тему" : "Включить режим чтения (светлая тема)"}
          >
            {isLightMode ? (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tColors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={5} />
                <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </Svg>
            ) : (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tColors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </Svg>
            )}
          </TouchableOpacity>

          <View style={styles.translationBlock}>
            <Text style={[styles.translationLabel, isLightMode && { color: tColors.accent }]}>ПЕРЕВОД</Text>
            <Text style={[styles.translatorName, isLightMode && { color: tColors.text }]}>Э. Кулиев</Text>
          </View>
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
                  isLightMode && {
                    borderColor: tColors.borderStrong,
                    backgroundColor: tColors.surface,
                  },
                  active && (isLightMode ? {
                    backgroundColor: tColors.surfaceActive,
                    borderColor: tColors.accent,
                  } : styles.reciterChipActive),
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
                    isLightMode && { color: tColors.muted },
                    active && (isLightMode ? { color: tColors.accent } : styles.reciterChipTextActive),
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
        extraData={isLightMode}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
      />

      {/* Tafsir Bottom Sheet Modal */}
      <Modal
        visible={tafsirModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeTafsir}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={[
              styles.modalBackdrop,
              isLightMode && { backgroundColor: tColors.sheetBackdrop },
            ]}
            activeOpacity={1}
            onPress={closeTafsir}
            accessibilityRole="button"
            accessibilityLabel="Закрыть затемнение"
          />
          <View
            style={[
              styles.sheetContainer,
              isLightMode && {
                backgroundColor: tColors.sheetBg,
                borderColor: tColors.border,
              },
            ]}
          >
            <View
              style={[
                styles.sheetHeader,
                isLightMode && { borderColor: tColors.borderSoft },
              ]}
            >
              <View style={styles.sheetTitleWrap}>
                <Text style={[styles.sheetTitle, isLightMode && { color: tColors.text }]}>
                  Тафсир ас-Саади
                </Text>
                <Text style={[styles.sheetAyahBadge, isLightMode && { color: tColors.accent }]}>
                  СУРА {surahNumber} · АЯТ {activeTafsir?.ayahNumber}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.sheetCloseBtn,
                  isLightMode && {
                    borderColor: tColors.border,
                    backgroundColor: tColors.numberPillBg,
                  },
                ]}
                onPress={closeTafsir}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tColors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M18 6 6 18M6 6l12 12" />
                </Svg>
              </TouchableOpacity>
            </View>

            <View style={styles.sheetBody}>
              {tafsirLoading ? (
                <View style={styles.sheetCenter}>
                  <ActivityIndicator size="large" color={tColors.accent} />
                </View>
              ) : tafsirError ? (
                <View style={styles.sheetCenter}>
                  <Text style={[styles.sheetErrorText, isLightMode && { color: tColors.text }]}>Не удалось загрузить тафсир</Text>
                  <TouchableOpacity
                    style={[
                      styles.sheetRetryBtn,
                      isLightMode && { borderColor: tColors.accent },
                    ]}
                    onPress={retryTafsir}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Повторить"
                  >
                    <Text style={[styles.sheetRetryBtnText, isLightMode && { color: tColors.accent }]}>Повторить</Text>
                  </TouchableOpacity>
                </View>
              ) : !tafsirText ? (
                <View style={styles.sheetCenter}>
                  <Text style={[styles.sheetEmptyText, isLightMode && { color: tColors.muted }]}>
                    Для этого аята отдельного тафсира нет: он может быть включён в комментарий к соседним аятам
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.sheetScrollView}
                  contentContainerStyle={styles.sheetScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {tafsirText.split("\n\n").filter(Boolean).map((p, i) => renderTafsirParagraph(p, i))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitleLine: {
    lineHeight: 34,
  },
  titleLatin: {
    fontFamily: fonts.ui.bold,
    fontSize: 18,
    lineHeight: 34,
    color: colors.text, // #EDE6D6
  },
  titleArabic: {
    fontFamily: fonts.arabic.bold,
    fontSize: 18,
    lineHeight: 34,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted, // #8FA89E
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  themeToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.button, // 14
    borderWidth: 1,
    borderColor: colors.border, // #243630
    backgroundColor: colors.surfaceActive, // #1B2F28
    alignItems: "center",
    justifyContent: "center",
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
    fontFamily: fonts.arabic.quran,
    fontSize: 30,
    lineHeight: 62,
    color: colors.text, // #EDE6D6
    textAlign: "right",
    writingDirection: "rtl",
  },
  tafsirButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  tafsirBtn: {
    height: 36,
    borderRadius: radii.pill, // 999
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.accent, // #E3BE72
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tafsirBtnActive: {
    backgroundColor: colors.surfaceActive, // #1B2F28
  },
  tafsirBtnText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accent, // #E3BE72
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheetContainer: {
    backgroundColor: colors.surface, // #15241F
    borderTopWidth: 1,
    borderColor: colors.border, // #243630
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "75%",
    maxHeight: "82%",
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft, // #1E2E28
  },
  sheetTitleWrap: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
    paddingRight: 12,
  },
  sheetTitle: {
    fontFamily: fonts.ui.bold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text, // #EDE6D6
  },
  sheetAyahBadge: {
    fontFamily: fonts.ui.semibold,
    fontSize: 11,
    lineHeight: 15,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.accent, // #E3BE72
    marginTop: 2,
  },
  sheetSubLabel: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted, // #8FA89E
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.button, // 14
    borderWidth: 1,
    borderColor: colors.border, // #243630
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sheetBody: {
    flex: 1,
  },
  sheetCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  sheetErrorText: {
    fontFamily: fonts.ui.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    textAlign: "center",
  },
  sheetRetryBtn: {
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  sheetRetryBtnText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accent,
  },
  sheetEmptyText: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
  },
  sheetScrollView: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  tafsirParagraph: {
    fontFamily: fonts.ui.regular,
    fontSize: 16,
    lineHeight: 26,
    color: colors.textDim,
    marginBottom: 12,
  },
  tafsirArabicQuote: {
    fontFamily: fonts.arabic.regular,
    fontSize: 18,
    lineHeight: 30,
    color: colors.text,
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
