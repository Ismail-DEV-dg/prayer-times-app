import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  G,
  Ellipse,
  Rect,
  Polygon,
  Circle,
  Path,
} from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";

/**
 * Stitch Architectural Mosque Silhouette (strictly WITHOUT domes)
 * Exact vector replica of the Grand Stepped Iwan & Minaret Silhouette
 * from the Stitch reference project ("тема приложение - Намаз").
 *
 * Variants:
 * - "standard" (default): 312x280 full atmospheric skyline for Main Screen, Settings Mockup, BootSplash.
 * - "banner": 380x120 wide horizontal architectural backdrop designed specifically for Quran and Qibla screens.
 *
 * Both variants preserve aspect ratio ("xMidYMax meet") by default so they never squish.
 */
export default function StitchMosque({
  colors: propColors,
  variant = "standard",
  width = "100%",
  height = 200,
  preserveAspectRatio = "xMidYMax meet",
  idPrefix = "mosque",
  showGlow = true,
  showWindows = true,
  opacity = 1.0,
  style,
}) {
  const theme = useTheme();
  const colors = propColors || theme.colors || {};

  const front1 = colors.mosqueFront1 || (colors.isDark ? "#0e2338" : "#c49a6c");
  const front2 = colors.mosqueFront2 || (colors.isDark ? "#050c17" : "#a47748");
  const back1 = colors.mosqueBack1 || (colors.isDark ? "#1b3f66" : "#e0c7a8");
  const back2 = colors.mosqueBack2 || (colors.isDark ? "#0d1f33" : "#c99e75");

  const glowColor = colors.glowColor || colors.accent || "#38bdf8";
  const glowOpacity =
    colors.glowOpacity !== undefined ? colors.glowOpacity : 0.25;

  const windowColor =
    colors.mosqueWindowColor || (colors.isDark ? "#fbbf24" : "#a39987");
  const windowOpacity =
    colors.mosqueWindowOpacity !== undefined
      ? colors.mosqueWindowOpacity
      : colors.isDark
      ? 0.85
      : 0.45;

  // Banner variant specific architectural color tokens
  const facade = colors.mosqueFacade || front1;
  const steps = colors.mosqueSteps || front2;
  const minaret = colors.mosqueMinaret || back1;
  const sill = colors.mosqueSill || back2;
  const arch = colors.mosqueArch || windowColor;
  const bannerWin = colors.mosqueWindow || windowColor;

  const gradFrontId = `${idPrefix}_gradFront`;
  const gradBackId = `${idPrefix}_gradBack`;
  const gradGlowId = `${idPrefix}_gradGlow`;

  return (
    <View
      style={[styles.container, { width, height, opacity }, style]}
      pointerEvents="none"
    >
      {variant === "banner" ? (
        /* WIDE HORIZONTAL BANNER VARIANT (380x120) - Used on Quran & Qibla screens */
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 380 120"
          preserveAspectRatio={preserveAspectRatio}
        >
          {/* Left Minaret: shaft, tiers, spire & slit window */}
          <Rect x="42" y="15" width="10" height="105" fill={sill} opacity={0.95} />
          <Rect x="40" y="38" width="14" height="4" fill={minaret} />
          <Rect x="39" y="70" width="16" height="4" fill={minaret} />
          <Polygon points="47,3 43,15 51,15" fill={sill} />
          <Rect
            x="45"
            y="46"
            width="4"
            height="9"
            rx="2"
            fill={bannerWin}
            opacity={windowOpacity}
          />

          {/* Right Minaret: shaft, tiers, spire & slit window */}
          <Rect x="328" y="15" width="10" height="105" fill={sill} opacity={0.95} />
          <Rect x="326" y="38" width="14" height="4" fill={minaret} />
          <Rect x="325" y="70" width="16" height="4" fill={minaret} />
          <Polygon points="333,3 329,15 337,15" fill={sill} />
          <Rect
            x="331"
            y="46"
            width="4"
            height="9"
            rx="2"
            fill={bannerWin}
            opacity={windowOpacity}
          />

          {/* Main Stepped Iwan Facade (strictly NO domes) */}
          <Path
            d="M90 120V72H120V58H150V46H230V58H260V72H290V120H90Z"
            fill={facade}
            opacity={0.95}
          />
          <Path d="M125 120V66H255V120H125Z" fill={steps} />

          {/* Triple Arched Gateway Portals */}
          <Path
            d="M142 120V92C142 84 148 78 155 78C162 78 168 84 168 92V120H142Z"
            fill={arch}
            opacity={windowOpacity}
          />
          <Path
            d="M174 120V82C174 70 181 62 190 62C199 62 206 70 206 82V120H174Z"
            fill={arch}
            opacity={windowOpacity}
          />
          <Path
            d="M212 120V92C212 84 218 78 225 78C232 78 238 84 238 92V120H212Z"
            fill={arch}
            opacity={windowOpacity}
          />
        </Svg>
      ) : (
        /* STANDARD ATMOSPHERIC SKYLINE VARIANT (312x280) - Used on Main Screen, Settings Mockup, BootSplash */
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 312 280"
          preserveAspectRatio={preserveAspectRatio}
        >
          <Defs>
            {/* Foreground Facade & Minaret Gradient */}
            <LinearGradient id={gradFrontId} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={front1} />
              <Stop offset="100%" stopColor={front2} />
            </LinearGradient>

            {/* Background Layer Gradient */}
            <LinearGradient id={gradBackId} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={back1} />
              <Stop offset="100%" stopColor={back2} />
            </LinearGradient>

            {/* Ambient Horizon Glow Gradient */}
            <LinearGradient id={gradGlowId} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={glowColor} stopOpacity={glowOpacity} />
              <Stop offset="100%" stopColor={glowColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          <G>
            {/* 1. Ambient Horizon Glow Ellipse behind skyline */}
            {showGlow && (
              <Ellipse
                cx="156"
                cy="180"
                rx="160"
                ry="60"
                fill={`url(#${gradGlowId})`}
              />
            )}

            {/* 2. Background Architectural Layer: Stepped terraces & far minarets (55% opacity) */}
            <G fill={`url(#${gradBackId})`} opacity={0.55}>
              {/* Far Left Minaret */}
              <Rect x="18" y="58" width="5" height="122" rx="0.5" />
              <Polygon points="20.5,42 24,58 17,58" />
              <Rect x="16" y="88" width="9" height="2.5" rx="0.5" />

              {/* Far Right Minaret */}
              <Rect x="288" y="38" width="6" height="142" rx="0.5" />
              <Polygon points="291,22 295,38 287,38" />
              <Rect x="286" y="68" width="10" height="3" rx="0.5" />

              {/* Stepped background roof terrace blocks (strictly NO domes) */}
              <Rect x="82" y="116" width="148" height="64" />
              <Rect x="78" y="112" width="156" height="5" />
              <Rect x="94" y="106" width="124" height="6" />
              <Rect x="108" y="101" width="96" height="5" />
            </G>

            {/* 3. Foreground Architectural Layer: Primary Minarets & Stepped Iwan (strictly NO domes) */}
            <G fill={`url(#${gradFrontId})`}>
              {/* Primary Left Minaret */}
              <Rect x="44" y="48" width="8" height="142" rx="1" />
              <Polygon points="48,32 53,48 43,48" />
              <Circle cx="48" cy="30" r="1.5" />
              <Rect x="42" y="75" width="12" height="3" rx="0.5" />
              <Rect x="42" y="108" width="12" height="3" rx="0.5" />

              {/* Primary Right Minaret */}
              <Rect x="260" y="26" width="9" height="164" rx="1" />
              <Polygon points="264.5,10 270,26 259,26" />
              <Circle cx="264.5" cy="8.5" r="1.5" />
              <Rect x="257" y="56" width="15" height="3.5" rx="0.8" />
              <Rect x="258" y="92" width="13" height="3" rx="0.8" />
              <Rect x="258" y="128" width="13" height="3" rx="0.8" />

              {/* Main Central Stepped Facade Structure */}
              <Rect x="52" y="132" width="208" height="58" />
              <Rect x="48" y="128" width="216" height="5" />
              <Rect x="106" y="106" width="100" height="84" />
              <Rect x="102" y="101" width="108" height="5" />
              <Rect x="112" y="96" width="88" height="5" />
              <Rect x="122" y="92" width="68" height="4" />
              {/* Solid Ground Base Foundation */}
              <Rect x="0" y="174" width="312" height="106" />
            </G>

            {/* 4. Arched Windows & Minaret Slits */}
            {showWindows && (
              <G>
                {/* Soft ambient window glow halos */}
                <Path
                  d="M138 140 Q138 122 156 122 Q174 122 174 140 L174 174 L138 174 Z"
                  fill={windowColor}
                  opacity={windowOpacity * 0.35}
                  stroke={windowColor}
                  strokeWidth={3}
                />
                <Path
                  d="M116 150 Q116 138 126 138 Q136 138 136 150 L136 174 L116 174 Z"
                  fill={windowColor}
                  opacity={windowOpacity * 0.3}
                  stroke={windowColor}
                  strokeWidth={2}
                />
                <Path
                  d="M176 150 Q176 138 186 138 Q196 138 196 150 L196 174 L176 174 Z"
                  fill={windowColor}
                  opacity={windowOpacity * 0.3}
                  stroke={windowColor}
                  strokeWidth={2}
                />

                {/* Central Grand Arch Portal */}
                <Path
                  d="M138 140 Q138 122 156 122 Q174 122 174 140 L174 174 L138 174 Z"
                  fill={windowColor}
                  opacity={windowOpacity}
                />

                {/* Left & Right Companion Arches */}
                <Path
                  d="M116 150 Q116 138 126 138 Q136 138 136 150 L136 174 L116 174 Z"
                  fill={windowColor}
                  opacity={windowOpacity * 0.9}
                />
                <Path
                  d="M176 150 Q176 138 186 138 Q196 138 196 150 L196 174 L176 174 Z"
                  fill={windowColor}
                  opacity={windowOpacity * 0.9}
                />

                {/* Outer Flanking Portal Arches */}
                <Path
                  d="M74 154 Q74 145 82 145 Q90 145 90 154 L90 172 L74 172 Z"
                  fill={windowColor}
                  opacity={windowOpacity * 0.9}
                />
                <Path
                  d="M222 154 Q222 145 230 145 Q238 145 238 154 L238 172 L222 172 Z"
                  fill={windowColor}
                  opacity={windowOpacity * 0.9}
                />

                {/* Minaret Window Slits */}
                <Rect
                  x="47"
                  y="86"
                  width="2"
                  height="7"
                  rx="1"
                  fill={windowColor}
                  opacity={windowOpacity * 0.85}
                />
                <Rect
                  x="263.5"
                  y="72"
                  width="2.5"
                  height="8"
                  rx="1"
                  fill={windowColor}
                  opacity={windowOpacity * 0.85}
                />
                <Rect
                  x="263.5"
                  y="108"
                  width="2.5"
                  height="8"
                  rx="1"
                  fill={windowColor}
                  opacity={windowOpacity * 0.85}
                />
              </G>
            )}
          </G>
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
