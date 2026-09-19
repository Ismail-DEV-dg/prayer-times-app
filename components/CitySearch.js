import React, { useState, useCallback, useRef } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeContext";
import { searchCities } from "../services/geocodingApi";

export default function CitySearch({ onSelect }) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);

  const runSearch = useCallback((text) => {
    setQuery(text);
    setError(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const cities = await searchCities(text);
        setResults(cities);
      } catch (e) {
        setError("Не удалось выполнить поиск. Проверьте интернет-соединение.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Поиск города…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={runSearch}
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={colors.accent} />}
        {!loading && query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery("");
              setResults([]);
              setError(null);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Очистить поиск"
          >
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      {results.length > 0 ? (
        <View style={styles.results}>
          {results.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.resultItem, { borderColor: colors.border }]}
              onPress={() => onSelect(item)}
            >
              <Ionicons name="location-outline" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultTitle, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
                  {[item.admin1, item.country].filter(Boolean).join(", ")}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : query.trim().length >= 2 && !loading ? (
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Ничего не найдено</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 4 },
  error: { marginBottom: 8 },
  results: { alignSelf: "stretch" },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultTitle: { fontSize: 16, fontWeight: "600" },
  resultSubtitle: { fontSize: 13, marginTop: 2 },
});
