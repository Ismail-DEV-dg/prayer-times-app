import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StitchMosque from "./StitchMosque";

const { width } = Dimensions.get("window");

// Splash / Boot screen faithfully based on Stitch design (Screen f6ceed1f9bda435da593ff33b1b653e7).
// Runs during app launch, displays spiritual typography, brand identity, progress indicator,
// and gracefully fades out to the main app shell.
export default function BootSplash() {
  const [visible, setVisible] = useState(true);
  const [progressPercent, setProgressPercent] = useState(15);
  const opacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0.15)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Logo soft scale in
    Animated.timing(logoScale, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // 2. Continuous shimmer animation on progress bar
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 3. Simulated fast sync progression
    const t1 = setTimeout(() => {
      setProgressPercent(48);
      Animated.timing(progressAnim, {
        toValue: 0.48,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }, 250);

    const t2 = setTimeout(() => {
      setProgressPercent(88);
      Animated.timing(progressAnim, {
        toValue: 0.88,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }, 550);

    const t3 = setTimeout(() => {
      setProgressPercent(100);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, 900);

    // 4. Smooth fade out
    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }, 1300);

    // Safety fallback
    const safetyTimer = setTimeout(() => setVisible(false), 2600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(fadeTimer);
      clearTimeout(safetyTimer);
    };
  }, []);

  if (!visible) return null;

  const progressInterpolate = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
      {/* Ambient background glow orbs */}
      <View style={styles.ambientGlowTop} />
      <View style={styles.ambientGlowCenter} />

      {/* Decorative stars */}
      <View style={[styles.star, { top: "12%", left: "15%" }]} />
      <View style={[styles.star, { top: "18%", right: "18%", opacity: 0.8 }]} />
      <View style={[styles.star, { top: "34%", left: "10%", opacity: 0.6 }]} />
      <View style={[styles.star, { top: "45%", right: "12%", opacity: 0.7 }]} />

      {/* Main Content Area */}
      <View style={styles.content}>
        {/* Sacred Bismillah Calligraphy */}
        <Text style={styles.bismillah}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</Text>

        {/* Central Brand Logo Container */}
        <Animated.View
          style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}
        >
          {/* Logo Halo Glow */}
          <View style={styles.logoHalo} />

          {/* Squircle App Icon Base from Stitch Project */}
          <View style={styles.squircle}>
            <Image
              source={require("../assets/icon.png")}
              style={styles.brandIconImage}
              resizeMode="cover"
            />
          </View>
        </Animated.View>

        {/* Brand App Name */}
        <Text style={styles.appName}>НАМАЗ</Text>

        {/* Subtitle with separator lines */}
        <View style={styles.subRow}>
          <View style={styles.subLine} />
          <Text style={styles.appSubtitle}>Время молитвы • Коран • Кибла</Text>
          <View style={styles.subLine} />
        </View>

        <Text style={styles.tagline}>Духовный спутник каждого мусульманина</Text>
      </View>

      {/* Architectural Mosque Skyline Silhouette at the bottom (strictly NO domes) */}
      <View style={styles.skylineWrap} pointerEvents="none">
        <StitchMosque
          variant="banner"
          idPrefix="splash"
          colors={{
            mosqueFront1: "#0a1f33",
            mosqueFront2: "#040913",
            mosqueBack1: "#0e2d4d",
            mosqueBack2: "#081626",
            glowColor: "#00c4cc",
            glowOpacity: 0.35,
            mosqueWindowColor: "#fde047",
            mosqueWindowOpacity: 0.95,
          }}
          width="100%"
          height={130}
          preserveAspectRatio="xMidYMax meet"
        />
      </View>

      {/* Bottom Loading Progress Section */}
      <View style={styles.loadingFooter}>
        <View style={styles.progressHeader}>
          <View style={styles.statusRow}>
            <View style={styles.pulsingDot}>
              <View style={styles.pulsingDotInner} />
            </View>
            <Text style={styles.statusText}>Синхронизация времени молитв...</Text>
          </View>
          <Text style={styles.percentText}>{progressPercent}%</Text>
        </View>

        {/* Illuminated Progress Bar */}
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[styles.progressBarFill, { width: progressInterpolate }]}
          />
        </View>

        {/* Location & Calculation Method Context */}
        <View style={styles.locationContext}>
          <Ionicons name="location-outline" size={13} color="#10b981" />
          <Text style={styles.locationContextText}>
            Москва, Россия • Метод: ДУМ РФ
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050c17",
    zIndex: 9999,
    justifyContent: "space-between",
    alignItems: "center",
  },
  ambientGlowTop: {
    position: "absolute",
    top: "15%",
    alignSelf: "center",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  ambientGlowCenter: {
    position: "absolute",
    top: "35%",
    alignSelf: "center",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(6, 182, 212, 0.08)",
  },
  star: {
    position: "absolute",
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    marginTop: 20,
  },
  bismillah: {
    fontSize: 22,
    color: "#fef08a",
    letterSpacing: 0.5,
    marginBottom: 24,
    opacity: 0.9,
    textAlign: "center",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
  },
  logoHalo: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(16, 185, 129, 0.22)",
  },
  squircle: {
    width: 104,
    height: 104,
    borderRadius: 28,
    backgroundColor: "#091c28",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },
  brandIconImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },
  geometricWatermark: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  moonIcon: {
    position: "absolute",
    top: 14,
    right: 18,
    opacity: 0.9,
  },
  mosqueIcon: {
    position: "absolute",
    bottom: 12,
    left: 24,
    opacity: 0.95,
  },
  appName: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 6,
    color: "#FFFFFF",
    textAlign: "center",
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  subLine: {
    width: 22,
    height: 1,
    backgroundColor: "rgba(16, 185, 129, 0.5)",
  },
  appSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tagline: {
    fontSize: 12,
    color: "#34d399",
    marginTop: 6,
    opacity: 0.85,
    fontWeight: "500",
  },
  skylineWrap: {
    width: "100%",
    height: 130,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
    position: "relative",
  },
  portalGlow: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
    width: 180,
    height: 24,
    backgroundColor: "rgba(254, 240, 138, 0.12)",
    borderRadius: 12,
  },
  loadingFooter: {
    width: "100%",
    maxWidth: 340,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 8,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(16, 185, 129, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  pulsingDotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#10b981",
  },
  statusText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
  },
  percentText: {
    fontSize: 12,
    color: "#34d399",
    fontWeight: "700",
  },
  progressBarTrack: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  locationContext: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 4,
  },
  locationContextText: {
    fontSize: 10.5,
    color: "#64748b",
  },
});
