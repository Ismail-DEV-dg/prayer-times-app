import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import StitchMosque from "./StitchMosque";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Stitch architectural vector ratio: 312x280 (280 / 312 ≈ 0.8974).
// Stretches height vertically to match Stitch proportions with zero horizontal squashing.
export const MOSQUE_HEIGHT = Math.max(300, Math.round(SCREEN_WIDTH * (280 / 312)));
// Shifted down towards the bottom tab bar without squashing the vector
export const MOSQUE_BOTTOM = -Math.round(MOSQUE_HEIGHT * 0.18);

// Detailed constellation of glowing stars for the atmospheric sky backdrop,
// lowered slightly down into the visible upper atmosphere.
const STARS = [
  // Top atmospheric layer (kept completely clear of the top-right header controls)
  { top: 46, left: "8%", size: 3, opacity: 0.95 },
  { top: 56, left: "20%", size: 2, opacity: 0.75 },
  { top: 42, left: "34%", size: 3.5, opacity: 1, sparkle: true },
  { top: 60, left: "48%", size: 2.5, opacity: 0.8 },
  { top: 48, left: "62%", size: 3, opacity: 0.9 },
  { top: 64, left: "74%", size: 2, opacity: 0.7 },

  // Mid atmospheric layer (around date and above hero)
  { top: 76, left: "14%", size: 2.5, opacity: 0.85 },
  { top: 90, left: "28%", size: 3.5, opacity: 0.95, sparkle: true },
  { top: 80, left: "42%", size: 2, opacity: 0.65 },
  { top: 96, left: "56%", size: 3, opacity: 0.9 },
  { top: 84, left: "68%", size: 2.5, opacity: 0.75 },
  { top: 94, left: "80%", size: 2.5, opacity: 0.7 },
  { top: 78, left: "91%", size: 2, opacity: 0.65 },

  // Lower atmospheric layer (behind date and above hero)
  { top: 118, left: "7%", size: 2, opacity: 0.6 },
  { top: 132, left: "22%", size: 3, opacity: 0.85 },
  { top: 114, left: "37%", size: 2.5, opacity: 0.7 },
  { top: 142, left: "50%", size: 3, opacity: 0.8, sparkle: true },
  { top: 124, left: "65%", size: 2, opacity: 0.65 },
  { top: 136, left: "79%", size: 3, opacity: 0.9 },
  { top: 120, left: "91%", size: 2.5, opacity: 0.75 },
  { top: 156, left: "15%", size: 2, opacity: 0.55 },
  { top: 164, left: "85%", size: 2.5, opacity: 0.7 },
];

export default function MosqueSilhouette() {
  const { colors, isDark, showMosqueBg } = useTheme();

  const showStars = colors.showStars !== undefined ? colors.showStars : isDark;
  const celestialColor = colors.celestialColor || (isDark ? "#E0ECFB" : "#E5A84B");
  const tint = colors.silhouetteTint || (isDark ? "#1E2A3A" : "#D2DDD4");
  const isSun = colors.celestialType === "sun";

  return (
    <View style={styles.container} pointerEvents="none">
      {/* 1. Sky Gradient Tint Layer (at the top) */}
      <View
        style={[
          styles.skyGradientWrap,
          {
            backgroundColor: colors.skyGradient?.[0] || colors.background,
            opacity: isDark ? 0.9 : 0.65,
          },
        ]}
      />

      {/* 2. Constellation of Glowing Stars (visible on dark / themed skies, lowered slightly) */}
      {showStars && (
        <View style={styles.starsContainer}>
          {STARS.map((s, i) => (
            <React.Fragment key={i}>
              <View
                style={[
                  styles.starDot,
                  {
                    top: s.top,
                    left: s.left,
                    width: s.size,
                    height: s.size,
                    borderRadius: s.size / 2,
                    opacity: s.opacity,
                  },
                ]}
              />
              {s.sparkle && (
                <Ionicons
                  name="sparkles"
                  size={10}
                  color="#FFFFFF"
                  style={[
                    styles.sparkleIcon,
                    {
                      top: s.top - 4,
                      left: s.left,
                      opacity: s.opacity * 0.9,
                    },
                  ]}
                />
              )}
            </React.Fragment>
          ))}
        </View>
      )}

      {/* 3. Celestial Body: Moon with sparkle or Warm Sun (lowered slightly to match stars) */}
      <View style={styles.celestialWrapper}>
        {isSun ? (
          <View style={[styles.sunGlow, { shadowColor: celestialColor }]}>
            <Ionicons name="sunny" size={26} color={celestialColor} />
          </View>
        ) : (
          <View style={[styles.moonGlow, { shadowColor: celestialColor }]}>
            <Ionicons name="moon" size={24} color={celestialColor} style={{ opacity: 0.95 }} />
            <Ionicons
              name="sparkles"
              size={12}
              color={celestialColor}
              style={styles.moonSparkle}
            />
          </View>
        )}
      </View>

      {/* 4. Architectural Mosque Skyline Silhouette (strictly NO domes, uncompressed natural proportions) */}
      {showMosqueBg !== false && (
        <View style={styles.skylineRow} pointerEvents="none">
          <StitchMosque
            idPrefix="home"
            colors={colors}
            width="100%"
            height={MOSQUE_HEIGHT}
            preserveAspectRatio="none"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  skyGradientWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 270,
  },
  starsContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 270,
  },
  starDot: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  sparkleIcon: {
    position: "absolute",
    marginLeft: -4,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 4,
  },
  celestialWrapper: {
    position: "absolute",
    top: 76,
    right: 22,
    zIndex: 2,
  },
  moonGlow: {
    position: "relative",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 4,
  },
  moonSparkle: {
    position: "absolute",
    top: -4,
    right: -7,
    opacity: 0.85,
  },
  sunGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 4,
  },
  skylineRow: {
    position: "absolute",
    bottom: MOSQUE_BOTTOM,
    left: 0,
    right: 0,
    height: MOSQUE_HEIGHT,
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 1,
  },
});
