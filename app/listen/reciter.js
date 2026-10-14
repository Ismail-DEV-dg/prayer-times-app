import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { colors, radii, fonts } from "../../theme/theme";
import {
  LISTEN_RECITERS,
  searchListenReciters,
} from "../../services/quranSurahAudioRegistry";
import { getListenReciter } from "../../utils/storage";
import SectionHeader from "../../components/ui/SectionHeader";

// Russian plural form: 1 чтец, 2–4 чтеца, 5+ чтецов
function pluralReciters(n) {
  const abs = Math.abs(n) % 100;
  const mod10 = abs % 10;
  if (abs > 10 && abs < 20) return "чтецов";
  if (mod10 === 1) return "чтец";
  if (mod10 >= 2 && mod10 <= 4) return "чтеца";
  return "чтецов";
}

// Reciter picker for the Listen mode. All 60 full-surah reciters, a
// searchable compact list (RU + EN spellings find the same reciter).
export default function ListenReciterScreen() {
  const { colors: _themeColors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [query, setQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedId, setSelectedId] = useState(params.current || null);
  const [pressedId, setPressedId] = useState(null);

  useEffect(() => {
    if (!selectedId) {
      getListenReciter()
        .then((id) => {
          if (id) setSelectedId(id);
        })
        .catch(() => {});
    }
  }, [selectedId]);

  const data = useMemo(() => {
    if (query.trim()) return searchListenReciters(query);
    return LISTEN_RECITERS;
  }, [query]);

  const choose = (reciter) => {
    router.replace({ pathname: "/listen/player", params: { reciter: reciter.id, picked: "1" } });
  };

  const goBackSafely = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/quran");
    }
  };

  const renderItem = ({ item }) => {
    const isSelected = item.id === selectedId;
    const isPressed = item.id === pressedId;
    const isActive = isSelected || isPressed;

    return (
      <TouchableOpacity
        style={[styles.reciterRow, isActive && styles.reciterRowActive]}
        onPress={() => choose(item)}
        onPressIn={() => setPressedId(item.id)}
        onPressOut={() => setPressedId(null)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Выбрать чтеца ${item.name}`}
      >
        <View style={styles.avatarBox}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4 15v-3a8 8 0 0 1 16 0v3" />
            <Rect x="3" y="14" width="4" height="7" rx="2" />
            <Rect x="17" y="14" width="4" height="7" rx="2" />
          </Svg>
        </View>

        <View style={styles.middleCol}>
          <Text style={styles.reciterName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.reciterSub} numberOfLines={1}>
            {item.nameEn}
          </Text>
        </View>

        {isSelected ? (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M20 6 9 17l-5-5" />
          </Svg>
        ) : (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="m9 18 6-6-6-6" />
          </Svg>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.headerWrap}>
        <SectionHeader
          title="Выберите чтеца"
          fontSize={24}
          lineHeight={32}
          onBackPress={goBackSafely}
        />
      </View>

      {/* Search Bar */}
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
          placeholder="Поиск чтеца…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          cursorColor={colors.accent}
          selectionColor={colors.accent}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />
        {query ? (
          <TouchableOpacity
            onPress={() => setQuery("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Очистить поиск"
            accessibilityRole="button"
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={12} r={9} />
              <Path d="m15 9-6 6M9 9l6 6" />
            </Svg>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Reciters List */}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Ничего не найдено</Text>
        }
        ListFooterComponent={
          data.length ? (
            <Text style={styles.footerText}>
              {data.length} {pluralReciters(data.length)} · полные суры · поиск на русском и английском
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
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
    borderColor: colors.accent, // #E3BE72
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.ui.regular,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text, // #EDE6D6
    paddingVertical: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 8,
  },
  reciterRow: {
    minHeight: 72,
    borderRadius: radii.row, // 18
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderSoft, // #1E2E28
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reciterRowActive: {
    backgroundColor: colors.surfaceActive, // #1B2F28
    borderColor: colors.accent, // #E3BE72
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: radii.iconBox, // 12
    backgroundColor: colors.surfaceActive, // #1B2F28
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  middleCol: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  reciterName: {
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.text, // #EDE6D6
  },
  reciterSub: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted, // #8FA89E
  },
  footerText: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted, // #8FA89E
    textAlign: "center",
    marginTop: 16,
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
