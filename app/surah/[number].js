import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
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
  const { colors } = useAppTheme();
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

    return (
      <TouchableOpacity
        style={[
          styles.ayahCard,
          {
            backgroundColor: isPlaying || isPaused ? colors.accentSoft : colors.card,
            borderColor: isPlaying || isPaused ? colors.accent : colors.border,
          },
        ]}
        onPress={() => playAyah(item, true)}
        activeOpacity={0.7}
      >
        <View style={styles.ayahTopRow}>
          <View style={[styles.ayahBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.ayahBadgeText, { color: colors.textOnActive }]}>
              {item.numberInSurah}
            </Text>
          </View>
          <View style={styles.audioState}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : hasError ? (
              <Ionicons name="warning-outline" size={18} color={colors.danger} />
            ) : isPlaying || isPaused ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <TouchableOpacity
                  onPress={() => audio.toggleLoop()}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name="repeat"
                    size={18}
                    color={audio.isLooping ? colors.accent : colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => playAyah(item, false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name={isPlaying ? "pause" : "play"} size={18} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ) : (
              <Ionicons name="headset-outline" size={18} color={colors.textSecondary} />
            )}
          </View>
        </View>

        <Text style={[styles.arabic, { color: colors.text }]} selectable>
          {item.arabic}
        </Text>

        {item.translation ? (
          <Text style={[styles.translation, { color: colors.textSecondary }]} selectable>
            {item.translation}
          </Text>
        ) : null}

        {hasError && (
          <Text style={[styles.audioErrorText, { color: colors.danger }]}>
            Не удалось загрузить аудио. Источники недоступны.
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !surah) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.muted, { color: colors.textSecondary, marginTop: 12 }]}>
            Загружаем суру…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.header}>
        <TouchableOpacity onPress={goBackSafely} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Сура {surahNumber}</Text>
        </View>
        <View style={[styles.center, { flex: 1, paddingHorizontal: 32 }]}>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text, textAlign: "center", marginTop: 8 }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent, marginTop: 16 }]}
            onPress={() => load(reciter)}
          >
            <Text style={{ color: colors.textOnActive, fontWeight: "700" }}>Повторить</Text>
          </TouchableOpacity>
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {surah.englishName} · {surah.name}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {surah.englishNameTranslation} · {surah.numberOfAyahs} аятов
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
          <Text style={{ fontSize: 9, color: colors.textSecondary, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.5 }}>
            Перевод
          </Text>
          <Text style={{ fontSize: 11, color: colors.text, fontWeight: "500", marginTop: 2 }}>
            Э. Кулиев
          </Text>
        </View>
      </View>

      <View style={[styles.reciterRow, { borderColor: colors.border }]}>
        {RECITERS.map((r) => {
          const active = reciter === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              style={[
                styles.reciterChip,
                {
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accentSoft : colors.card,
                },
              ]}
              onPress={() => changeReciter(r.id)}
            >
              <Text
                style={{ color: active ? colors.accent : colors.textSecondary, fontSize: 11, fontWeight: "600" }}
                numberOfLines={1}
              >
                {r.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={surah.ayahs}
        keyExtractor={(a) => String(a.numberInSurah)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={renderAyah}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 2 },
  reciterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  reciterChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: "center",
  },
  center: { alignItems: "center", justifyContent: "center" },
  muted: { fontSize: 14 },
  errorText: { fontSize: 15, lineHeight: 21, textAlign: "center" },
  retryButton: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  ayahCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  ayahTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  ayahBadge: {
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: "center",
  },
  ayahBadgeText: { fontSize: 12, fontWeight: "800" },
  arabic: {
    fontSize: 24,
    lineHeight: 44,
    textAlign: "right",
    writingDirection: "rtl",
  },
  translation: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  audioErrorText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: "500",
  },
});
