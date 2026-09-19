import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../theme/ThemeContext";
import { LISTEN_RECITERS } from "../services/quranSurahAudioRegistry";

// Quran entry screen: two equal mode cards — LISTEN (full-surah audio,
// 60 reciters) and READ (surah list with Arabic text + translation).
// Each card navigates to its own screen, mirroring the app's pattern
// of stack-based navigation for every major feature.
export default function QuranScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();

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

      <View style={styles.modeRow}>
        {/* LISTEN card — full surah audio with 60 reciters */}
        <TouchableOpacity
          style={[styles.modeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/listen")}
          activeOpacity={0.75}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="headset" size={24} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modeTitle, { color: colors.text }]}>Слушать</Text>
            <Text style={[styles.modeSub, { color: colors.textSecondary }]}>
              {LISTEN_RECITERS.length} чтецов · суры целиком
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* READ card — surah list with Arabic text and Kuliev translation */}
        <TouchableOpacity
          style={[styles.modeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/read")}
          activeOpacity={0.75}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="book" size={24} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modeTitle, { color: colors.text }]}>Читать</Text>
            <Text style={[styles.modeSub, { color: colors.textSecondary }]}>
              114 сур · текст + перевод
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: "800" },
  modeRow: { padding: 16, gap: 12 },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modeTitle: { fontSize: 17, fontWeight: "800" },
  modeSub: { fontSize: 13, marginTop: 3 },
});
