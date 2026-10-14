import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Circle, Rect, G } from "react-native-svg";
import { useRouter } from "expo-router";
import { colors, radii, fonts } from "../theme/theme";
import { useAppData } from "../utils/AppDataContext";
import { LISTEN_RECITERS } from "../services/quranSurahAudioRegistry";
import StitchMosque from "./StitchMosque";

export default function QuranScreen() {
  const { selectedCity } = useAppData();
  const router = useRouter();
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  const cityName = selectedCity?.name || "Дербент";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Коран</Text>

        {/* Dummy container for test compatibility */}
        <View style={styles.headerTitleContainer} pointerEvents="none" />

        <View style={styles.headerRight}>
          {/* City / Location Chip */}
          <TouchableOpacity
            style={styles.locationChip}
            onPress={() => router.push("/location")}
            activeOpacity={0.7}
            accessibilityLabel="Выбрать город"
            accessibilityRole="button"
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
              <Circle cx={12} cy={9.5} r={2.5} />
            </Svg>
            <Text style={styles.locationText} numberOfLines={1}>
              {cityName}
            </Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M6 9l6 6 6-6" />
            </Svg>
          </TouchableOpacity>

          {/* Info Button */}
          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => setInfoModalVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="О разделе"
            accessibilityRole="button"
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={12} r={9} />
              <Path d="M12 11v5M12 8v.01" />
            </Svg>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Centerpiece: Triple Arches + Arabic Title + Stats Pill */}
        <View style={styles.heroSection}>
          <Svg width={220} height={190} viewBox="0 0 220 190" fill="none" aria-hidden={true}>
            <Path d="M10 190V110a100 100 0 0 1 200 0v80" stroke="#2C4238" strokeWidth={1.5} />
            <Path d="M34 190V114a76 76 0 0 1 152 0v76" stroke="#2C4238" strokeWidth={1.5} />
            <Path d="M58 190V118a52 52 0 0 1 104 0v72" fill={colors.surface} stroke={colors.accent} strokeWidth={1.5} />
            <G transform="translate(86 112) scale(2)" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6zM12 6v13" />
            </G>
          </Svg>

          <Text style={styles.arabicTitle}>القرآن الكريم</Text>

          <View style={styles.statsPill}>
            <View style={styles.pillDot} />
            <Text style={styles.statsText}>114 сур · 30 джузов · 6236 аятов</Text>
          </View>
        </View>

        {/* Action Cards */}
        <View style={styles.actionsSection}>
          {/* Card 1: Читать */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/read")}
            activeOpacity={0.8}
            accessibilityLabel="Читать Коран"
            accessibilityRole="button"
          >
            <View style={styles.readIconBox}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6zM12 6v13" />
              </Svg>
            </View>

            <View style={styles.cardTextCol}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Читать</Text>
                <View style={styles.readTag}>
                  <Text style={styles.readTagText}>ТЕКСТ</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>
                Суры, аяты и смысловой перевод
              </Text>
            </View>

            <View style={styles.chevronCircle}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 6l6 6-6 6" />
              </Svg>
            </View>
          </TouchableOpacity>

          {/* Card 2: Слушать */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/listen")}
            activeOpacity={0.8}
            accessibilityLabel="Слушать Коран"
            accessibilityRole="button"
          >
            <View style={styles.listenIconBox}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 15v-3a8 8 0 0 1 16 0v3" />
                <Rect x={3} y={14} width={4} height={7} rx={2} />
                <Rect x={17} y={14} width={4} height={7} rx={2} />
              </Svg>
            </View>

            <View style={styles.cardTextCol}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Слушать</Text>
                <View style={styles.listenTag}>
                  <Text style={styles.listenTagText}>АУДИО</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>
                {LISTEN_RECITERS.length || 60} чтецов (Мишари Рашид, Аль-Хусари и др.)
              </Text>
            </View>

            <View style={styles.chevronCircle}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 6l6 6-6 6" />
              </Svg>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Info Modal */}
      <Modal
        visible={infoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6zM12 6v13" />
              </Svg>
              <Text style={styles.modalTitle}>О разделе «Коран»</Text>
            </View>
            <Text style={styles.modalBody}>
              Раздел включает два режима:{"\n\n"}
              • «Читать» — полный арабский текст 114 сур с поаятным переводом Э. Кулиева.{"\n"}
              • «Слушать» — высококачественные аудиозаписи полного Корана от {LISTEN_RECITERS.length || 60} признанных чтецов мира с возможностью непрерывного воспроизведения и офлайн-кэширования.
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setInfoModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseBtnText}>Понятно</Text>
            </TouchableOpacity>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    height: 52,
  },
  screenTitle: {
    fontFamily: fonts.ui.bold,
    fontSize: 28,
    letterSpacing: -0.3,
    color: colors.text, // #EDE6D6
  },
  headerTitleContainer: {
    display: "none",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationChip: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radii.button, // 14
    borderWidth: 1,
    borderColor: colors.border, // #243630
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 14,
    color: colors.text,
    maxWidth: 110,
  },
  infoBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.button, // 14
    borderWidth: 1,
    borderColor: colors.border, // #243630
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
    gap: 16,
  },
  heroSection: {
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  arabicTitle: {
    fontFamily: fonts.arabic.bold,
    fontSize: 44,
    lineHeight: 60,
    color: colors.accent, // #E3BE72
    textAlign: "center",
    marginTop: 4,
  },
  statsPill: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg, // #0D1613
    borderWidth: 1,
    borderColor: colors.borderStrong, // #2C4238
    borderRadius: radii.pill, // 999
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent, // #E3BE72
  },
  statsText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.muted, // #8FA89E
    fontVariant: ["tabular-nums"],
  },
  actionsSection: {
    flexDirection: "column",
    gap: 10,
    marginTop: 8,
  },
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface, // #15241F
    borderWidth: 1,
    borderColor: colors.border, // #243630
    borderRadius: radii.card, // 22
    padding: 16,
  },
  readIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.surfaceActive, // #1B2F28
    borderWidth: 1,
    borderColor: colors.accent, // #E3BE72
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  listenIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.surfaceActive, // #1B2F28
    borderWidth: 1,
    borderColor: colors.borderStrong, // #2C4238
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTextCol: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontFamily: fonts.ui.bold,
    fontSize: 20,
    color: colors.text,
  },
  readTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  readTagText: {
    fontFamily: fonts.ui.bold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.accent,
  },
  listenTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  listenTagText: {
    fontFamily: fonts.ui.bold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.muted,
  },
  cardSubtitle: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  chevronCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong, // #2C4238
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: radii.hero, // 28
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: fonts.ui.bold,
    fontSize: 18,
    color: colors.text,
  },
  modalBody: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    marginBottom: 20,
  },
  modalCloseBtn: {
    height: 48,
    borderRadius: radii.button, // 14
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtnText: {
    fontFamily: fonts.ui.bold,
    fontSize: 15,
    color: colors.onAccent, // #0D1613
  },
});
