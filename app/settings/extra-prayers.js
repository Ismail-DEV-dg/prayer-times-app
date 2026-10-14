import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../theme/ThemeContext";
import { useAppData } from "../../utils/AppDataContext";

export default function ExtraPrayersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { extraPrayers, updateExtraPrayers } = useAppData();
  const [infoModalData, setInfoModalData] = useState(null);

  const toggle = (key) => {
    updateExtraPrayers({ ...extraPrayers, [key]: !extraPrayers[key] });
  };

  const renderRow = (key, title, description, infoData) => (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.textContainer}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
          {infoData && (
            <TouchableOpacity 
              onPress={() => setInfoModalData(infoData)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ marginLeft: 8 }}
            >
              <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>{description}</Text>
      </View>
      <Switch
        value={extraPrayers[key]}
        onValueChange={() => toggle(key)}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Дополнительные молитвы</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Включите отображение желательных (сунна) ночных молитв в общем расписании.
        </Text>
        
        {renderRow(
          "tahajjud",
          "Тахаджуд",
          "Время Тахаджуда наступает в последнюю треть ночи.",
          {
            title: "Награда за Тахаджуд",
            hadith: "Передают со слов Абу Хурайры, да будет доволен им Аллах, что Посланник Аллаха, да благословит его Аллах и приветствует, сказал: «С наступлением последней трети каждой ночи Всеблагой и Всевышний Господь наш нисходит к нижнему небу, говоря: “Кто станет обращаться ко Мне с мольбами, чтобы Я ответил ему? Кто станет просить Меня (о чём-нибудь), чтобы Я даровал ему (это)? Кто станет молить Меня о прощении, чтобы Я простил его?”»",
            source: "аль-Бухари (1145)"
          }
        )}
        
        {renderRow(
          "duha",
          "Духа",
          "Время Духа начинается через 20 минут после Восхода (когда солнце поднимется на высоту копья).",
          {
            title: "Награда за молитву Духа",
            hadith: "Сообщается со слов Абу Зарра, что Посланник Аллаха ﷺ сказал: «С наступлением утра каждому из вас следует давать милостыню (садака) в количестве суставов (его тела). Произнесение слов “Пречист Аллах” (субхана-ллах) — это милостыня, и каждое произнесение слов “Хвала Аллаху” (аль-хамду ли-ллях) — это милостыня, и каждое произнесение слов “Нет божества, достойного поклонения, кроме Аллаха” (ля иляха илля-ллах) — это милостыня, и каждое произнесение слов “Аллах велик” (Аллаху акбар) — это милостыня, и повеление одобряемого (шариатом) — это милостыня, и удерживание от порицаемого (шариатом) — это милостыня. Но всё это заменяет собой два рак‘ата молитвы “духа”».",
            source: "Сахих Муслим (720)"
          }
        )}
      </ScrollView>

      {/* Info Modal */}
      <Modal
        visible={!!infoModalData}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModalData(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="information-circle" size={24} color={colors.accent} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: colors.text, flex: 1 }]}>{infoModalData?.title}</Text>
            </View>
            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalBody, { color: colors.text, fontStyle: "italic" }]}>
                {infoModalData?.hadith}
              </Text>
              <Text style={[styles.modalSource, { color: colors.textSecondary }]}>
                — {infoModalData?.source}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: colors.accent }]}
              onPress={() => setInfoModalData(null)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textOnActive || "#FFF" }]}>Понятно</Text>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: "800" },
  content: { padding: 20, paddingBottom: 40 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  textContainer: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowDesc: { fontSize: 13, lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalBodyScroll: {
    marginBottom: 20,
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 24,
  },
  modalSource: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 12,
  },
  modalCloseBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
