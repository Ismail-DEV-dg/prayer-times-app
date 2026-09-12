import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeContext";
import { methodName } from "../services/prayerApi";

// Small auto-dismissing popup (about 2.6 s) describing where the
// shown schedule comes from. Only real data from the API layer is
// displayed — nothing is invented. Not a separate screen: a mini
// overlay anchored near the source badge.
const VISIBLE_MS = 2600;

export default function SourceInfoToast({ visible, source, fromCache, calcMethod, onClose }) {
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;
  const hideTimer = useRef(null);

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      rise.setValue(12);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(rise, {
          toValue: 0,
          speed: 20,
          bounciness: 4,
          useNativeDriver: true,
        }),
      ]).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(onClose, VISIBLE_MS);
    } else {
      opacity.setValue(0);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [visible]);

  if (!visible || !source) return null;

  const typeLabel =
    fromCache
      ? "Сохранённое расписание (нет сети)"
      : source.type === "calculated"
      ? "Расчётное расписание"
      : "Официальное расписание";
  const methodLabel = calcMethod ? methodName(calcMethod) : null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: "#000",
          opacity,
          transform: [{ translateY: rise }],
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Ionicons name="information-circle" size={16} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {source.name || typeLabel}
        </Text>
      </View>
      <Text style={[styles.line, { color: colors.textSecondary }]}>Тип: {typeLabel}</Text>
      {source.type === "calculated" && methodLabel ? (
        <Text style={[styles.line, { color: colors.textSecondary }]}>Метод: {methodLabel}</Text>
      ) : null}
      {source.url ? (
        <Text style={[styles.line, { color: colors.textSecondary }]} numberOfLines={1}>
          {source.url}
        </Text>
      ) : null}
      {source.lastUpdated ? (
        <Text style={[styles.line, { color: colors.textSecondary }]}>
          Обновлено: {new Date(source.lastUpdated).toLocaleString("ru-RU")}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 14, fontWeight: "700", flex: 1 },
  line: { fontSize: 12, lineHeight: 16 },
});
