import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { getListenReciter, getListenPosition } from "../../utils/storage";
import { getListenReciter as getReciterById, DEFAULT_LISTEN_RECITER } from "../../services/quranSurahAudioRegistry";

// Listen mode entry: routes to the saved reciter's player right away, or
// to the reciter picker on the very first visit. The user never sees this
// screen — it renders a brief loader and immediately redirects.
export default function ListenEntryScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [savedReciter, position] = await Promise.all([
        getListenReciter(),
        getListenPosition(),
      ]);
      if (cancelled) return;
      setChecked(true);
      // A saved id that is no longer in the registry (e.g. the old
      // ey:…/af:… universe) falls back to the default reciter.
      if (savedReciter && getReciterById(savedReciter)) {
        const params = new URLSearchParams();
        params.set("reciter", savedReciter);
        if (position) {
          params.set("surah", String(position.surah));
          // ms offset is re-read from storage by the player (resume)
        }
        router.replace(`/listen/player?${params.toString()}`);
      } else {
        router.replace("/listen/reciter");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.center, { flex: 1 }]}>
        {checked ? null : <ActivityIndicator size="large" color={colors.accent} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
});
