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
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
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

// FULL-SURAH Listen player. ONE SURAH = ONE CONTINUOUS TRACK: a single
// Sound loads the entire surah ({server}/NNN.mp3), so the progress bar,
// seek, Play/Pause and didJustFinish all refer to the whole surah
// (Al-Kahf shows ~61:47, not 5 seconds of one ayah). Previous/Next move
// between SURAHS; didJustFinish auto-advances to the next surah and
// keeps playing. The reading mode (useAyahAudio, per-ayah EveryAyah) is
// a completely separate screen and is not touched here.
export default function ListenPlayerScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [reciterId, setReciterId] = useState(null);
  const [surahs, setSurahs] = useState(null);
  const [surahNumber, setSurahNumber] = useState(1);
  const [surahPickerOpen, setSurahPickerOpen] = useState(false);
  const [surahQuery, setSurahQuery] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(true);

  const audio = useSurahAudio();

  const currentKey = reciterId ? `${reciterId}/${surahNumber}` : null;

  const surah = useMemo(
    () => (surahs || []).find((s) => s.number === surahNumber) || null,
    [surahs, surahNumber]
  );

  // --- mount: reciter + saved position + surah list --------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // reciter: URL param (picker handoff) -> saved -> default
      let id = typeof params.reciter === "string" ? params.reciter : null;
      if (!id || !getListenReciter(id)) {
        id = (await getSavedListenReciter()) || DEFAULT_LISTEN_RECITER;
      }
      if (!getListenReciter(id)) id = DEFAULT_LISTEN_RECITER;
      // position: URL params (entry handoff) -> saved position -> 1
      let s = Number(params.surah);
      let resumeMs = 0;
      const pos = await getListenPosition();
      if (!Number.isInteger(s) || s < 1 || s > 114) {
        // no surah in params: resume the saved position (or surah 1)
        if (pos) {
          s = pos.surah;
          resumeMs = pos.ms || 0;
        } else {
          s = 1;
        }
      } else if (pos && pos.surah === s) {
        // surah given via params (entry handoff): if the saved position
        // belongs to the SAME surah, resume its offset; otherwise start
        // from the beginning (reciter change / picker selection).
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
        // The player can still work without names (numbers only).
        if (!cancelled) setSurahs([]);
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // resume offset captured on mount (from the saved position)
  const resumeMsRef = useRef(0);

  // --- persist the reciter choice --------------------------------------
  useEffect(() => {
    if (reciterId) saveListenReciter(reciterId).catch(() => {});
  }, [reciterId]);

  // --- load the full surah track whenever reciter/surah change ----------
  // Also the initial load (plays the saved surah from the saved offset).
  const loadSurah = useCallback(
    (s, startMs = 0) => {
      if (!reciterId) return;
      const primary = getSurahAudioUrl(reciterId, s);
      const fallback = getSurahAudioFallbackUrl(reciterId, s);
      if (!primary) return;
      audio.load(primary, `${reciterId}/${s}`, fallback, startMs).catch(() => {});
    },
    [reciterId, audio]
  );

  useEffect(() => {
    if (!reciterId || loadingMeta) return; // wait for the entry setup
    loadSurah(surahNumber, resumeMsRef.current);
    resumeMsRef.current = 0; // resume offset only applies once
    // loadingMeta flips once (true -> false) after the metadata setup and
    // triggers the FIRST load; later runs fire on reciter/surah changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciterId, surahNumber, loadingMeta]);

  // --- persist the last position (surah + track offset) ------------------
  // The audio hook streams position updates; throttled saves every ~5s
  // and on pause/surah change keep the storage writes cheap.
  const lastSaveRef = useRef(0);
  useEffect(() => {
    if (!reciterId || audio.status === "idle" || audio.status === "error") return;
    const now = Date.now();
    if (now - lastSaveRef.current < 5000 && audio.status !== "paused") return;
    lastSaveRef.current = now;
    saveListenPosition(surahNumber, audio.positionMillis).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahNumber, reciterId, audio.positionMillis, audio.status]);

  // --- auto-advance on REAL didJustFinish of the whole surah ------------
  // audio.setOnFinish fires only from the status callback of the CURRENT
  // sound with didJustFinish === true (see useSurahAudio). On the last
  // surah (114) playback simply stops — no wrap-around.
  const onFinishRef = useRef(null);
  useEffect(() => {
    onFinishRef.current = (key) => {
      if (key !== `${reciterId}/${surahNumber}`) return;
      if (surahNumber >= 114) return; // last surah: honest stop
      setSurahNumber((s) => Math.min(114, s + 1)); // loads+plays via effect
    };
  });
  useEffect(() => {
    audio.setOnFinish((key) => {
      if (onFinishRef.current) onFinishRef.current(key);
    });
  });

  // --- controls ----------------------------------------------------------
  const onPlayPause = () => {
    audio.playPause().catch(() => {});
  };

  // Previous/Next = previous/next SURAHS (not ayahs).
  const onPrev = () => {
    setSurahNumber((s) => Math.max(1, s - 1));
  };
  const onNext = () => {
    setSurahNumber((s) => Math.min(114, s + 1));
  };

  const onStop = () => {
    audio.unload().catch(() => {});
  };

  const onChangeReciter = () => {
    // Stop the current sound before leaving — the old reciter must not
    // keep playing while the user browses the picker.
    audio.unload().catch(() => {});
    router.push("/listen/reciter");
  };

  // Surah picker: search by number / english name / translation / arabic.
  const filteredSurahs = useMemo(() => {
    const q = surahQuery.trim().toLowerCase();
    if (!q) return surahs || [];
    return (surahs || []).filter(
      (s) =>
        String(s.number) === q ||
        s.englishName.toLowerCase().includes(q) ||
        (s.englishNameTranslation || "").toLowerCase().includes(q) ||
        (s.name || "").includes(surahQuery.trim())
    );
  }, [surahs, surahQuery]);

  const reciter = reciterId ? getListenReciter(reciterId) : null;

  const goBackSafely = () => {
    audio.unload().catch(() => {});
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/quran");
    }
  };

  // --- seek bar (drag over the whole surah track) -------------------------
  // We track the bar's on-screen X position (pageX from onLayout) so that
  // during a drag we can compute:
  //   ratio = (gestureState.moveX - barPageX) / barWidth
  // This is reliable even when the touch wanders outside the bar view.
  // Using evt.nativeEvent.locationX in onPanResponderMove is NOT reliable
  // because the event coordinate origin can shift mid-gesture on Android.
  const barWidthRef = useRef(1);
  const barPageXRef = useRef(0);   // absolute screen X of the bar's left edge
  const durationRef = useRef(0);   // read at gesture time, avoids stale closure
  const seekPreviewRef = useRef(null);
  const barViewRef = useRef(null);

  // Keep durationRef in sync
  useEffect(() => {
    durationRef.current = audio.durationMillis || 0;
  }, [audio.durationMillis]);

  const [seekPreview, setSeekPreview] = useState(null); // 0..1 or null

  // PanResponder created ONCE — no deps. All values are read from refs.
  const seekBarPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        // Fallback: if measure() failed or hasn't run, calculate pageX dynamically
        // locationX is the relative touch position in the bar, pageX is absolute
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

  // --- render -------------------------------------------------------------
  if (!reciterId) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackSafely} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Слушать</Text>
      </View>

      {/* reciter card: current reciter + compact "change" button */}
      <View style={[styles.reciterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reciterLabel, { color: colors.textSecondary }]}>Чтец</Text>
          <Text style={[styles.reciterName, { color: colors.text }]} numberOfLines={1}>
            {reciter ? reciter.name : "…"}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.changeButton, { borderColor: colors.accent }]}
          onPress={onChangeReciter}
        >
          <Ionicons name="swap-horizontal-outline" size={14} color={colors.accent} />
          <Text style={[styles.changeButtonText, { color: colors.accent }]}>Изменить чтеца</Text>
        </TouchableOpacity>
      </View>

      {/* now playing: the whole surah as ONE track */}
      <View style={[styles.nowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {loadingMeta ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <>
            <Text style={[styles.surahLabel, { color: colors.textSecondary }]}>
              Сура · целиком
            </Text>
            <TouchableOpacity
              style={[styles.surahButton, { borderColor: colors.border }]}
              onPress={() => {
                setSurahQuery("");
                setSurahPickerOpen(true);
              }}
            >
              <Text style={[styles.surahName, { color: colors.text }]} numberOfLines={1}>
                {surah
                  ? `${surahNumber}. ${surah.englishName} · ${surah.name}`
                  : `Сура ${surahNumber}`}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Полный аудиотрек суры · {isPlaying || isPaused ? fmt(positionMs) : "00:00"} из{" "}
              {durationMs ? fmt(durationMs) : "…"}
            </Text>
          </>
        )}
      </View>

      {/* progress of the WHOLE surah track */}
      <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View
          ref={barViewRef}
          style={[styles.progressBar, { backgroundColor: colors.accentSoft }]}
          onLayout={(e) => {
            barWidthRef.current = e.nativeEvent.layout.width;
            barViewRef.current?.measure?.((x, y, width, height, pageX) => {
              if (pageX != null) barPageXRef.current = pageX;
            });
          }}
          {...seekBarPan.panHandlers}
        >
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.accent, width: `${progressRatio * 100}%` },
            ]}
          >
            {/* Thumb: visible drag handle at the current position */}
            <View
              pointerEvents="none"
              style={[styles.progressThumb, { backgroundColor: colors.accent, borderColor: colors.card }]}
            />
          </View>
        </View>
        <View style={styles.progressTimes}>
          <Text style={[styles.progressTime, { color: colors.textSecondary }]}>
            {fmt(positionMs)}
          </Text>
          <Text style={[styles.progressTime, { color: colors.textSecondary }]}>
            {durationMs ? fmt(durationMs) : "--:--"}
          </Text>
        </View>
      </View>

      {/* controls: prev/next = surahs */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={onPrev}
          disabled={surahNumber <= 1}
          hitSlop={{ top: 10, bottom: 10 }}
        >
          <Ionicons
            name="play-skip-back"
            size={30}
            color={surahNumber <= 1 ? colors.textSecondary : colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: colors.accent }]}
          onPress={onPlayPause}
          disabled={isLoading}
        >
          {isLoading || (isPlaying && audio.isBuffering) ? (
            <ActivityIndicator size="small" color={colors.textOnActive} />
          ) : isPlaying ? (
            <Ionicons name="pause" size={32} color={colors.textOnActive} />
          ) : (
            <Ionicons name="play" size={32} color={colors.textOnActive} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={onNext}
          disabled={surahNumber >= 114}
          hitSlop={{ top: 10, bottom: 10 }}
        >
          <Ionicons
            name="play-skip-forward"
            size={30}
            color={surahNumber >= 114 ? colors.textSecondary : colors.text}
          />
        </TouchableOpacity>
      </View>

      {hasError ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>
          Не удалось загрузить аудио этой суры. Проверьте подключение и попробуйте ещё раз.
        </Text>
      ) : null}


      {/* surah picker modal */}
      <Modal visible={surahPickerOpen} animationType="slide" transparent={false} onRequestClose={() => setSurahPickerOpen(false)}>
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setSurahPickerOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Выбрать суру</Text>
          </View>
          <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Номер или название суры…"
              placeholderTextColor={colors.textSecondary}
              value={surahQuery}
              onChangeText={setSurahQuery}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={filteredSurahs}
            keyExtractor={(s) => String(s.number)}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.surahRow,
                  {
                    backgroundColor: item.number === surahNumber ? colors.accentSoft : colors.card,
                    borderColor: item.number === surahNumber ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => {
                  setSurahNumber(item.number);
                  setSurahPickerOpen(false);
                }}
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
            )}
            ListEmptyComponent={
              <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 20 }}>
                Ничего не найдено
              </Text>
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
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: "800" },
  center: { alignItems: "center", justifyContent: "center" },
  reciterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  reciterLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  reciterName: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  changeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  changeButtonText: { fontSize: 12, fontWeight: "700" },
  nowCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 10,
    alignItems: "center",
  },
  surahLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, alignSelf: "flex-start" },
  surahButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 6,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  surahName: { fontSize: 16, fontWeight: "800", flex: 1, textAlign: "center" },
  hint: { fontSize: 12, marginTop: 10, textAlign: "center" },
  progressCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  progressBar: { height: 22, borderRadius: 11, overflow: "visible", justifyContent: "center" },
  progressFill: { height: 6, borderRadius: 3, marginLeft: 0, justifyContent: "center", overflow: "visible" },
  progressThumb: {
    position: "absolute",
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    top: -5,
  },
  progressTimes: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  progressTime: { fontSize: 12, fontVariant: ["tabular-nums"] },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 34 },
  controlBtn: { padding: 8 },
  playBtn: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 13, textAlign: "center", marginTop: 10 },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 12,
  },
  stopText: { fontSize: 12, fontWeight: "600" },
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
