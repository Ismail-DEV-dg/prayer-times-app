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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeContext";
import { useAppData } from "../utils/AppDataContext";
import { LISTEN_RECITERS } from "../services/quranSurahAudioRegistry";
import StitchMosque from "./StitchMosque";

// Quran screen faithfully based on Stitch design (Screen 6868d05c1c2b4cd6ad83eedcfa38270c).
// Displays the Holy Quran title, surah counter badge, open Quran medallion artwork,
// mosque architecture backdrop, and two primary action cards: Читать and Слушать.
// Strictly NO theme selector on this screen.
export default function QuranScreen() {
  const { colors } = useTheme();
  const { selectedCity } = useAppData();
  const router = useRouter();
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  const cityName = selectedCity?.name || "Мекка";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        {/* City / Location Pill */}
        <TouchableOpacity
          style={[
            styles.locationPill,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          onPress={() => router.push("/location")}
          activeOpacity={0.7}
        >
          <Ionicons name="location-sharp" size={14} color={colors.accent} />
          <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
            {cityName}
          </Text>
          <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Center Title (perfectly centered on screen) */}
        <View style={styles.headerTitleContainer} pointerEvents="none">
          <Text style={[styles.headerTitle, { color: colors.text }]}>Коран</Text>
        </View>

        {/* Help / Info Button */}
        <TouchableOpacity
          style={[
            styles.infoButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setInfoModalVisible(true)}
          accessibilityLabel="Справка"
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Centerpiece & Decorative Artwork Section */}
        <View style={styles.heroSection}>
          {/* Subtle glow orb behind Quran artwork */}
          <View
            style={[
              styles.artworkGlow,
              {
                backgroundColor: colors.heroGlow || colors.accentSoft || "rgba(13, 148, 136, 0.15)",
              },
            ]}
          />

          {/* Open Quran Medallion Artwork */}
          <View style={styles.quranMedallion}>
            {/* Top crescent & star ornament */}
            <View style={styles.crescentDecor}>
              <Ionicons
                name="moon"
                size={22}
                color={colors.celestialColor || colors.accent}
              />
              <Ionicons
                name="sparkles"
                size={11}
                color={colors.celestialColor || colors.accent}
                style={{ position: "absolute", top: -2, right: -6 }}
              />
            </View>

            {/* Book stand / Rehal structure with Open Book */}
            <View
              style={[
                styles.bookStandWrap,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={78}
                color={colors.accent}
              />
            </View>
          </View>

          {/* Arabic Holy Title */}
          <Text
            style={[
              styles.arabicTitle,
              { color: colors.quranGoldTitle || colors.accent },
            ]}
          >
            القرآن الكريم
          </Text>

          {/* Surah Counter Badge */}
          <View
            style={[
              styles.counterBadge,
              {
                backgroundColor: colors.badgeBg || "rgba(255,255,255,0.08)",
                borderColor: colors.badgeBorder || colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.livePulseDot,
                { backgroundColor: colors.accent },
              ]}
            />
            <Text
              style={[
                styles.counterText,
                { color: colors.badgeText || colors.textSecondary },
              ]}
            >
              114 Сур • 30 Джузов • 6236 Аятов
            </Text>
          </View>

          {/* Architectural Mosque Backdrop (banner variant, strictly NO domes) */}
          <View style={styles.mosqueBackdropWrap} pointerEvents="none">
            <StitchMosque
              variant="banner"
              idPrefix="quran"
              colors={colors}
              width="100%"
              height={100}
              preserveAspectRatio="xMidYMax meet"
              showGlow={false}
              opacity={colors.isDark ? 0.75 : 0.6}
            />
          </View>
        </View>

        {/* ================= 2 PRIMARY ACTION BUTTONS ================= */}
        <View style={styles.actionsSection}>
          {/* 1. Читать (Read Quran) */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push("/read")}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: colors.accentSoft || "rgba(13, 148, 136, 0.14)",
                  borderColor: colors.accent,
                },
              ]}
            >
              <Ionicons name="book-outline" size={26} color={colors.accent} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.actionTitleRow}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Читать
                </Text>
                <View
                  style={[
                    styles.tagBadge,
                    {
                      backgroundColor: colors.accentSoft || "rgba(13, 148, 136, 0.12)",
                    },
                  ]}
                >
                  <Text style={[styles.tagText, { color: colors.accent }]}>
                    Текст
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.actionSubtitle, { color: colors.textSecondary }]}
              >
                Суры, аяты и смысловой перевод
              </Text>
            </View>

            <View
              style={[
                styles.arrowCircle,
                {
                  backgroundColor: colors.cardSecondary || colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* 2. Слушать (Listen to Quran Audio) */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push("/listen")}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: "rgba(168, 85, 247, 0.14)",
                  borderColor: "#a855f7",
                },
              ]}
            >
              <Ionicons name="headset-outline" size={26} color="#a855f7" />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.actionTitleRow}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Слушать
                </Text>
                <View
                  style={[
                    styles.tagBadge,
                    {
                      backgroundColor: "rgba(168, 85, 247, 0.14)",
                    },
                  ]}
                >
                  <Text style={[styles.tagText, { color: "#a855f7" }]}>
                    Аудио
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.actionSubtitle, { color: colors.textSecondary }]}
              >
                {LISTEN_RECITERS.length} чтецов (Мишари Рашид, Аль-Хусари и др.)
              </Text>
            </View>

            <View
              style={[
                styles.arrowCircle,
                {
                  backgroundColor: colors.cardSecondary || colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
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
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Ionicons name="book" size={24} color={colors.accent} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>О разделе «Коран»</Text>
            </View>
            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
              Раздел включает два режима:{"\n\n"}
              • «Читать» — полный арабский текст 114 сур с поаятным переводом Э. Кулиева.{"\n"}
              • «Слушать» — высококачественные аудиозаписи полного Корана от 60 признанных чтецов мира с возможностью непрерывного воспроизведения и офлайн-кэширования.
            </Text>
            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: colors.accent }]}
              onPress={() => setInfoModalVisible(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textOnActive || "#FFF" }]}>
                Понятно
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 52,
  },
  headerTitleContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: "40%",
    zIndex: 2,
  },
  locationText: {
    fontSize: 12,
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  infoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  heroSection: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 10,
    position: "relative",
  },
  artworkGlow: {
    position: "absolute",
    top: 20,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  quranMedallion: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    position: "relative",
  },
  crescentDecor: {
    alignItems: "center",
    marginBottom: 4,
  },
  bookStandWrap: {
    padding: 14,
    borderRadius: 26,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  arabicTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
    textAlign: "center",
  },
  counterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  counterText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  mosqueBackdropWrap: {
    width: "100%",
    height: 100,
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: -4,
    overflow: "hidden",
  },
  actionsSection: {
    gap: 12,
    marginTop: 8,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  actionSubtitle: {
    fontSize: 12.5,
    marginTop: 3,
  },
  arrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalBody: {
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalCloseBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
