import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";

// Minimalist boot splash shown once on top of the app shell.
//
// The native splash (app.json, backgroundColor #0F172A) already covers
// the cold start; this overlay continues the SAME background so the
// handoff is seamless, adds the app identity (Kaaba cube — the same
// motif as the Qibla screen) and fades out quickly (~1 s total).
//
// Rules (deliberately strict):
//   - never blocks the real startup: pointerEvents="none" — the app
//     underneath stays fully interactive while the overlay fades;
//   - zero logic dependencies: pure static views, no data, no fonts;
//   - all motion is one-shot Animated with useNativeDriver;
//   - always unmounts (animation end callback OR safety timer).

// Fixed brand colors: the boot splash must match the NATIVE splash
// background regardless of the app theme (the native layer is always
// #0F172A), so we do not read useAppTheme() here.
const SPLASH_BG = "#0F172A";
const CUBE = "#15181D";
const CUBE_EDGE = "rgba(255,255,255,0.16)";
const BAND = "#C9A227";
const GLOW = "#2E9E7C";
const TITLE = "#F2F4F7";
const SUB = "#94A3B8";

const ENTER_MS = 260; // overlay fade-in
const HOLD_MS = 620; // identity visible
const FADE_MS = 360; // fade-out
const SAFETY_MS = 2400; // force unmount even if a callback is lost

export default function BootSplash() {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(0)).current;
  const cubeScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: ENTER_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    Animated.timing(cubeScale, {
      toValue: 1,
      duration: ENTER_MS * 2,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    let hidden = false;
    const hide = () => {
      if (hidden) return;
      hidden = true;
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    };
    const holdTimer = setTimeout(hide, ENTER_MS + HOLD_MS);
    const safetyTimer = setTimeout(() => setVisible(false), SAFETY_MS);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(safetyTimer);
    };
  }, [opacity, cubeScale]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <View style={styles.glow} />
      <Animated.View
        style={[styles.cubeWrap, { transform: [{ scale: cubeScale }] }]}
      >
        <View style={[styles.cube, { backgroundColor: CUBE, borderColor: CUBE_EDGE }]}>
          <View style={[styles.band, { backgroundColor: BAND }]} />
        </View>
      </Animated.View>
      <Text style={[styles.title, { color: TITLE }]}>Время намаза</Text>
      <Text style={[styles.sub, { color: SUB }]}>Prayer Times</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: GLOW,
    opacity: 0.1,
  },
  cubeWrap: { alignItems: "center", justifyContent: "center" },
  cube: {
    width: 96,
    height: 96,
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  band: { height: 18, marginTop: 26, marginHorizontal: 8, borderRadius: 3 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: 0.4, marginTop: 28 },
  sub: { fontSize: 13, fontWeight: "600", letterSpacing: 2, marginTop: 6, opacity: 0.8 },
});
