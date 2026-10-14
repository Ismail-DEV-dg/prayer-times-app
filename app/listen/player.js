import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { colors, radii, fonts } from "../../theme/theme";
import { fetchSurahList } from "../../services/quranApi";
import {
  getListenReciter as getSavedListenReciter,
  saveListenReciter,
  getListenPosition,
  saveListenPosition,
} from "../../utils/storage";
import {
  DEFAULT_LISTEN_RECITER,
  getListenReciter,
  getSurahAudioUrl,
  getSurahAudioFallbackUrl,
} from "../../services/quranSurahAudioRegistry";
import { useSurahAudio } from "../../hooks/useSurahAudio";
import SectionHeader from "../../components/ui/SectionHeader";

// FULL-SURAH Listen player. ONE SURAH = ONE CONTINUOUS TRACK: a single
// Sound loads the entire surah ({server}/NNN.mp3), so the progress bar,
// seek, Play/Pause and didJustFinish all refer to the whole surah.
export default function ListenPlayerScreen() {
  const { colors: _themeColors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [reciterId, setReciterId] = useState(null);
  const [surahs, setSurahs] = useState(null);
  const [surahNumber, setSurahNumber] = useState(1);
  const [surahPickerOpen, setSurahPickerOpen] = useState(false);
  const [surahQuery, setSurahQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const audio = useSurahAudio();

  const currentKey = reciterId ? `${reciterId}/${surahNumber}` : null;

  const surah = useMemo(
    () => (surahs || []).find((s) => s.number === surahNumber) || null,
    [surahs, surahNumber]
  );

  // --- mount: reciter + saved position + surah list --------------------
  const resumeMsRef = useRef(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let id = typeof params.reciter === "string" ? params.reciter : null;
      if (!id || !getListenReciter(id)) {
        id = (await getSavedListenReciter()) || DEFAULT_LISTEN_RECITER;
      }
      if (!getListenReciter(id)) id = DEFAULT_LISTEN_RECITER;

      let s = Number(params.surah);
      let resumeMs = 0;
      const pos = await getListenPosition();
      if (!Number.isInteger(s) || s < 1 || s > 114) {
        if (pos) {
          s = pos.surah;
          resumeMs = pos.ms || 0;
        } else {
          s = 1;
        }
      } else if (pos && pos.surah === s) {
        resumeMs = pos.ms || 0;
      }
      if (!Number.isInteger(s) || s < 1 || s > 114) s = 1;
      if (cancelled) return;
      setReciterId(id);
      setSurahNumber(s);
      resumeMsRef.current = resumeMs;
      try {
        const list = await fetchSurahList();
        if (!cancelled) setSurahs(list);
      } catch (e) {
        if (!cancelled) setSurahs([]);
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.reciter, params.surah]);

  // persist the active reciter whenever it changes
  useEffect(() => {
    if (reciterId) saveListenReciter(reciterId);
  }, [reciterId]);

  // Auto-play / load when reciter or surah changes
  const lastKeyRef = useRef(null);
  useEffect(() => {
    if (!reciterId || !surahNumber) return;
    const key = `${reciterId}/${surahNumber}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const primaryUrl = getSurahAudioUrl(reciterId, surahNumber);
    const fallbackUrl = getSurahAudioFallbackUrl(reciterId, surahNumber);
    if (!primaryUrl) return;

    const initialOffset = resumeMsRef.current;
    resumeMsRef.current = 0;

    audio
      .loadTrack({
        key,
        primaryUrl,
        fallbackUrl,
        autoPlay: true,
        initialPositionMillis: initialOffset,
      })
      .catch((err) => {
        console.warn("[ListenPlayer] loadTrack error:", err?.message || err);
      });
  }, [reciterId, surahNumber, audio]);

  // Handle track finished -> next surah
  const onTrackFinished = useCallback(() => {
    if (surahNumber < 114) {
      setSurahNumber((n) => n + 1);
    }
  }, [surahNumber]);

  useEffect(() => {
    if (audio.didJustFinish) {
      onTrackFinished();
    }
  }, [audio.didJustFinish, onTrackFinished]);

  // Periodically persist playback position
  const lastSavedPosRef = useRef(0);
  useEffect(() => {
    if (audio.status !== "playing" && audio.status !== "paused") return;
    const pos = audio.positionMillis || 0;
    if (Math.abs(pos - lastSavedPosRef.current) > 4000) {
      lastSavedPosRef.current = pos;
      saveListenPosition(surahNumber, pos);
    }
  }, [audio.status, audio.positionMillis, surahNumber]);

  const reciter = reciterId ? getListenReciter(reciterId) : null;

  const onPrev = () => {
    if (surahNumber > 1) {
      saveListenPosition(surahNumber, 0);
      setSurahNumber((n) => n - 1);
    }
  };

  const onNext = () => {
    if (surahNumber < 114) {
      saveListenPosition(surahNumber, 0);
      setSurahNumber((n) => n + 1);
    }
  };

  const onPlayPause = () => {
    if (audio.status === "playing") {
      audio.pause();
    } else if (audio.status === "paused") {
      audio.play();
    } else if (audio.status === "idle" || audio.status === "error") {
      const primaryUrl = getSurahAudioUrl(reciterId, surahNumber);
      const fallbackUrl = getSurahAudioFallbackUrl(reciterId, surahNumber);
      if (primaryUrl) {
        audio.loadTrack({
          key: currentKey,
          primaryUrl,
          fallbackUrl,
          autoPlay: true,
        });
      }
    }
  };

  const onChangeReciter = () => {
    router.push("/listen/reciter");
  };

  const goBackSafely = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/quran");
    }
  };

  // --- Seek Bar PanResponder ---------------------------------------------
  const [seekPreview, setSeekPreview] = useState(null);
  const seekPreviewRef = useRef(null);
  const barViewRef = useRef(null);
  const barWidthRef = useRef(1);
  const barPageXRef = useRef(0);
  const durationRef = useRef(0);
  durationRef.current = audio.durationMillis || 0;

  const seekBarPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (barPageXRef.current === 0 && evt.nativeEvent.pageX > 0 && evt.nativeEvent.locationX >= 0) {
          barPageXRef.current = evt.nativeEvent.pageX - evt.nativeEvent.locationX;
        }

        const ratio = clamp01(
          (evt.nativeEvent.pageX - barPageXRef.current) / Math.max(1, barWidthRef.current)
        );
        seekPreviewRef.current = ratio;
        setSeekPreview(ratio);
      },
      onPanResponderMove: (_evt, gestureState) => {
        const ratio = clamp01(
          (gestureState.moveX - barPageXRef.current) / Math.max(1, barWidthRef.current)
        );
        seekPreviewRef.current = ratio;
        setSeekPreview(ratio);
      },
      onPanResponderRelease: () => {
        const ratio = seekPreviewRef.current;
        setSeekPreview(null);
        seekPreviewRef.current = null;
        if (ratio != null && Number.isFinite(ratio) && durationRef.current > 0) {
          audio.seekTo(ratio * durationRef.current).catch(() => {});
        }
      },
      onPanResponderTerminate: () => {
        seekPreviewRef.current = null;
        setSeekPreview(null);
      },
    })
  ).current;

  const durationMs = audio.durationMillis || 0;
  const positionMs = audio.positionMillis || 0;
  const progressRatio =
    seekPreview != null
      ? seekPreview
      : durationMs > 0
      ? clamp01(positionMs / durationMs)
      : 0;

  const fmt = (ms) => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const isPlaying = audio.status === "playing";
  const isPaused = audio.status === "paused";
  const isLoading = audio.status === "loading";
  const hasError = audio.status === "error";

  const filteredSurahs = (surahs || []).filter((s) => {
    const q = surahQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(s.number) === q ||
      s.englishName.toLowerCase().includes(q) ||
      (s.englishNameTranslation || "").toLowerCase().includes(q) ||
      (s.name || "").includes(surahQuery.trim())
    );
  });

  if (!reciterId) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.headerWrap}>
        <SectionHeader
          title="Слушать"
          fontSize={24}
          lineHeight={32}
          onBackPress={goBackSafely}
        />
      </View>

      <View style={styles.cardsContainer}>
        {/* Card 1: Reciter Card */}
        <View style={styles.reciterCard}>
          <View style={styles.reciterInfo}>
            <Text style={styles.label}>ЧТЕЦ</Text>
            <Text style={styles.reciterName} numberOfLines={1}>
              {reciter ? reciter.name : "…"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.changeBtn}
            onPress={onChangeReciter}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Изменить чтеца"
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />
            </Svg>
            <Text style={styles.changeBtnText}>Изменить чтеца</Text>
          </TouchableOpacity>
        </View>

        {/* Card 2: Surah Selection Card */}
        <View style={styles.surahCard}>
          {loadingMeta ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <Text style={styles.label}>СУРА · ЦЕЛИКОМ</Text>

              <TouchableOpacity
                style={styles.surahSelector}
                onPress={() => {
                  setSurahQuery("");
                  setSurahPickerOpen(true);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Выбрать суру"
              >
                <View style={styles.surahSelectorContent}>
                  <Text numberOfLines={1}>
                    <Text style={styles.surahLatinText}>
                      {surah ? `${surahNumber}. ${surah.englishName} ` : `Сура ${surahNumber} `}
                    </Text>
                    {surah?.name ? (
                      <Text style={styles.surahArabicText}>
                        · {surah.name}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="m6 9 6 6 6-6" />
                </Svg>
              </TouchableOpacity>

              <Text style={styles.surahHint}>
                Полный аудиотрек суры · {isPlaying || isPaused ? fmt(positionMs) : "0:00"} из{" "}
                {durationMs ? fmt(durationMs) : "0:51"}
              </Text>
            </>
          )}
        </View>

        {/* Card 3: Progress Card */}
        <View style={styles.progressCard}>
          <View
            ref={barViewRef}
            style={styles.progressTouchArea}
            onLayout={(e) => {
              barWidthRef.current = e.nativeEvent.layout.width;
              barViewRef.current?.measure?.((x, y, width, height, pageX) => {
                if (pageX != null) barPageXRef.current = pageX;
              });
            }}
            {...seekBarPan.panHandlers}
          >
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressRatio * 100}%` },
                ]}
              >
                <View pointerEvents="none" style={styles.progressThumb} />
              </View>
            </View>
          </View>

          <View style={styles.progressTimes}>
            <Text style={styles.progressTime}>{fmt(positionMs)}</Text>
            <Text style={styles.progressTime}>
              {durationMs ? fmt(durationMs) : "--:--"}
            </Text>
          </View>
        </View>

        {/* Center Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={onPrev}
            disabled={surahNumber <= 1}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Предыдущая сура"
            accessibilityRole="button"
          >
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={surahNumber <= 1 ? colors.muted : colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="m19 20-12-8 12-8v16zM5 19V5" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playBtn}
            onPress={onPlayPause}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityLabel={isPlaying ? "Пауза" : "Воспроизвести"}
            accessibilityRole="button"
          >
            {isLoading || (isPlaying && audio.isBuffering) ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : isPlaying ? (
              <Svg width={32} height={32} viewBox="0 0 24 24" fill={colors.onAccent} stroke={colors.onAccent} strokeWidth={1.5}>
                <Rect x="6" y="4" width="4" height="16" rx="1" fill={colors.onAccent} />
                <Rect x="14" y="4" width="4" height="16" rx="1" fill={colors.onAccent} />
              </Svg>
            ) : (
              <Svg width={32} height={32} viewBox="0 0 24 24" fill={colors.onAccent} stroke={colors.onAccent} strokeWidth={1.5}>
                <Path d="m6 4 14 8-14 8V4z" fill={colors.onAccent} />
              </Svg>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={onNext}
            disabled={surahNumber >= 114}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Следующая сура"
            accessibilityRole="button"
          >
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={surahNumber >= 114 ? colors.muted : colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="m5 4 12 8-12 8V4zM19 5v14" />
            </Svg>
          </TouchableOpacity>
        </View>

        {hasError ? (
          <Text style={styles.errorText}>
            Не удалось загрузить аудио этой суры. Проверьте подключение и попробуйте ещё раз.
          </Text>
        ) : null}
      </View>

      {/* Surah Picker Modal */}
      <Modal
        visible={surahPickerOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSurahPickerOpen(false)}
      >
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <StatusBar style="light" />

          <View style={styles.headerWrap}>
            <SectionHeader
              title="Выбрать суру"
              fontSize={24}
              lineHeight={32}
              onBackPress={() => setSurahPickerOpen(false)}
            />
          </View>

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
              value={surahQuery}
              onChangeText={setSurahQuery}
              autoCorrect={false}
              cursorColor={colors.accent}
              selectionColor={colors.accent}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
          </View>

          <FlatList
            data={filteredSurahs}
            keyExtractor={(s) => String(s.number)}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item.number === surahNumber;
              return (
                <TouchableOpacity
                  style={[
                    styles.surahRow,
                    isSelected && styles.surahRowSelected,
                  ]}
                  onPress={() => {
                    setSurahNumber(item.number);
                    setSurahPickerOpen(false);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
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
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Ничего не найдено</Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
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
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  label: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.accent, // #E3BE72
  },
  reciterCard: {
    backgroundColor: colors.surface, // #15241F
    borderWidth: 1,
    borderColor: colors.border, // #243630
    borderRadius: radii.card, // 22
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reciterInfo: {
    flex: 1,
    gap: 4,
  },
  reciterName: {
    fontFamily: fonts.ui.bold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text, // #EDE6D6
  },
  changeBtn: {
    height: 44,
    borderRadius: radii.button, // 14
    borderWidth: 1,
    borderColor: colors.accent, // #E3BE72
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  changeBtnText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.accent, // #E3BE72
  },
  surahCard: {
    backgroundColor: colors.surface, // #15241F
    borderWidth: 1,
    borderColor: colors.border, // #243630
    borderRadius: radii.card, // 22
    padding: 16,
    gap: 8,
  },
  surahSelector: {
    height: 52,
    borderRadius: radii.button, // 14
    backgroundColor: colors.bg, // #0D1613
    borderWidth: 1,
    borderColor: colors.borderStrong, // #2C4238
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    gap: 8,
  },
  surahSelectorContent: {
    flex: 1,
    justifyContent: "center",
  },
  surahLatinText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  surahArabicText: {
    fontFamily: fonts.arabic.bold,
    fontSize: 20,
    lineHeight: 32,
    color: colors.text,
  },
  surahHint: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted, // #8FA89E
    textAlign: "center",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  progressCard: {
    backgroundColor: colors.surface, // #15241F
    borderWidth: 1,
    borderColor: colors.border, // #243630
    borderRadius: radii.card, // 22
    padding: 16,
  },
  progressTouchArea: {
    height: 28,
    justifyContent: "center",
  },
  progressBarTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.borderSoft, // #1E2E28
    position: "relative",
    justifyContent: "center",
  },
  progressFill: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.accent, // #E3BE72
    position: "relative",
  },
  progressThumb: {
    position: "absolute",
    right: -7,
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent, // #E3BE72
  },
  progressTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressTime: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted, // #8FA89E
    fontVariant: ["tabular-nums"],
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 36,
    marginTop: 12,
  },
  controlBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent, // #E3BE72
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accent,
    textAlign: "center",
    marginTop: 8,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
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
    borderColor: colors.accent,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.ui.regular,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
    paddingVertical: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 8,
  },
  surahRow: {
    height: 76,
    borderRadius: radii.row,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  surahRowSelected: {
    backgroundColor: colors.surfaceActive,
    borderColor: colors.accent,
  },
  numberBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.iconBox,
    backgroundColor: colors.surfaceActive,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  numberText: {
    fontFamily: fonts.ui.bold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.accent,
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
    color: colors.text,
  },
  translation: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  arabicName: {
    fontFamily: fonts.arabic.bold,
    fontSize: 24,
    lineHeight: 40,
    color: colors.text,
    textAlign: "right",
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
