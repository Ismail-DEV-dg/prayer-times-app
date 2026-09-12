import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";
import {
  getNextPrayer,
  getMsUntilPrayer,
  formatCountdown,
} from "../utils/time";

// Countdown to the next PRAYER (Sunrise is excluded upstream — the
// caller passes prayers only). All math is done in the SELECTED CITY's
// timezone, so GPS=Helsinki + selectedCity=Mecca counts down to Mecca's
// next prayer at Mecca's clock time. Source-agnostic: works identically
// for official (Muftiate) and calculated (AlAdhan) schedules.
//
// Subtle motion (native driver, no logic changes): a one-time entrance
// fade/slide and a gentle pulsing "live" dot next to the label.
export default function NextPrayer({ prayers, timezone }) {
  const { colors } = useAppTheme();
  const [nowMs, setNowMs] = useState(() => Date.now());

  const entrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // One-time entrance: fade in + slide up. Runs on mount only.
  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  // Gentle "live" pulse for the dot (looping, native-driver opacity).
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  if (!prayers || prayers.length === 0) return null;

  const next = getNextPrayer(prayers, timezone);
  if (!next) return null;

  const msLeft = getMsUntilPrayer(next.time, timezone, next.tomorrow);

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.accent },
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.glow} />
      <View style={styles.labelRow}>
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: colors.textOnActive, opacity: pulse },
          ]}
        />
        <Text style={[styles.label, { color: colors.textOnActive }]}>
          Следующий намаз
        </Text>
      </View>
      <Text style={[styles.name, { color: colors.textOnActive }]}>{next.name}</Text>
      <Text style={[styles.time, { color: colors.textOnActive }]}>{next.time}</Text>
      <Text style={[styles.countdown, { color: colors.textOnActive }]}>
        через {formatCountdown(msLeft)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 22,
    marginVertical: 16,
    overflow: "hidden",
    // soft depth under the hero card
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  // subtle top-left light glint inside the hero card (pure decoration)
  glow: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, opacity: 0.85, fontWeight: "600" },
  name: { fontSize: 22, fontWeight: "700" },
  time: { fontSize: 36, fontWeight: "800", marginVertical: 2 },
  countdown: { fontSize: 15, opacity: 0.9, fontVariant: ["tabular-nums"] },
});
