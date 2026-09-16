import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import {
  LISTEN_RECITERS,
  searchListenReciters,
} from "../../services/quranSurahAudioRegistry";

// Reciter picker for the Listen mode. All 60 full-surah reciters, a
// searchable compact list (RU + EN spellings find the same reciter).
//
// When opened from the player ("Изменить чтеца") the selected row is
// highlighted; picking a row saves the choice and returns to the player.
export default function ListenReciterScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();

  const [query, setQuery] = useState("");

  const data = useMemo(() => {
    if (query.trim()) return searchListenReciters(query);
    return LISTEN_RECITERS;
  }, [query]);

  const choose = (reciter) => {
    // The player screen reads the reciter from storage when it mounts
    // WITHOUT reciter params; "replace" keeps the back stack clean
    // (picker -> player, no dead picker below the player).
    router.replace({ pathname: "/listen/player", params: { reciter: reciter.id, picked: "1" } });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.reciterRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => choose(item)}
    >
      <View style={[styles.reciterAvatar, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name="headset-outline" size={16} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.reciterName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.reciterSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.nameEn}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const goBackSafely = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/quran");
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackSafely} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Выберите чтеца</Text>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Поиск чтеца…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        keyboardShouldPersistTaps="handled"
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 20 }}>
            Ничего не найдено
          </Text>
        }
        ListFooterComponent={
          data.length ? (
            <Text style={[styles.footer, { color: colors.textSecondary }]}>
              {data.length} чтецов · полные суры · поиск на русском и английском
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: "800" },
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
  reciterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  reciterAvatar: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  reciterName: { fontSize: 15, fontWeight: "600" },
  reciterSub: { fontSize: 11, marginTop: 1 },
  footer: { fontSize: 12, textAlign: "center", marginTop: 14, marginBottom: 6 },
});
