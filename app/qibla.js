import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../theme/ThemeContext";
import { useAppData } from "../utils/AppDataContext";
import {
  qiblaBearing,
  fetchMagneticDeclination,
  magnetometerToHeading,
} from "../services/qiblaApi";
import { createLockMachine, signedDelta, LOCK_ANIM_MS } from "../utils/qiblaLock";
import { Magnetometer } from "expo-sensors";

// Qibla screen. The DIRECTION MATH (qiblaBearing, magnetometerToHeading,
// declination) is unchanged. This screen only renders it differently:
// a minimal circle, a soft light beam rotating around the center, and a
// small Kaaba icon on the ring. The user rotates the phone until the
// beam points at the Kaaba icon — that moment the phone points at the
// Qibla (same alignment condition as before: heading ≈ bearing).
//
// PERFORMANCE MODEL (the previous compass felt like ~30 FPS because it
// re-rendered React 10x/second and rotated the whole dial via style
// props). Now:
//   - the sensor callback does only cheap math and pushes an Animated
//     target — ZERO setState, ZERO React re-renders during rotation
//     (not even for the lock badge: it is driven by a native Animated
//     opacity);
//   - the beam rotation runs on the NATIVE driver — the UI thread
//     interpolates at 60 FPS between the JS-pushed targets;
//   - the beam angle is accumulated UNWRAPPED (never taken modulo 360),
//     so the 0/360 crossing can never produce a jump;
//   - the only React state left is coarse: sensor availability, GPS
//     status, the bearing value and the declination note.

// Sensor + animation tuning.
const SENSOR_INTERVAL_MS = 30; // raw magnetometer rate (callback = cheap math only)
const TRACK_ANIM_MS = 90; // native interpolation window per tick (≈3 ticks → continuous motion)

// Whether this device exposes a magnetometer (needed for a live
// compass). Never fakes availability.
async function isMagnetometerAvailable() {
  try {
    return await Magnetometer.isAvailableAsync();
  } catch (e) {
    return false;
  }
}

// Lock behavior (sustained alignment → hold ~1.5-2 s → release, soft
// fixation easing, tolerances) lives in the pure state machine
// utils/qiblaLock.js — unit-tested in Node.

// Dial geometry (single place for the absolutely-positioned children).
const DIAL_SIZE = 272;
const DIAL_RADIUS = DIAL_SIZE / 2;

export default function QiblaScreen() {
  const { colors } = useAppTheme();
  const { currentLocation, locationStatus, locateUser } = useAppData();
  const router = useRouter();

  const [bearing, setBearing] = useState(null);
  const [declination, setDeclination] = useState(null);
  const [declinationLoaded, setDeclinationLoaded] = useState(false);
  const [sensorAvailable, setSensorAvailable] = useState(null); // null = checking

  // Native-driven animation values (untouched by re-renders).
  const dialAnim = useRef(new Animated.Value(0)).current; // beam rotation, unwrapped degrees
  const lockGlow = useRef(new Animated.Value(0)).current; // 0 = free, 1 = locked (badge + glow)

  // Sensor-side mutable state — the ONLY things the magnetometer
  // callback touches (all refs, no React state).
  const bearingRef = useRef(null);
  const declinationRef = useRef(null);
  const subscriptionRef = useRef(null);
  const prevScreenAngleRef = useRef(null); // last beam angle on screen, 0..360
  const freeUnwrappedRef = useRef(0); // continuous (unwrapped) beam angle
  const lockRef = useRef(null); // lock state machine (utils/qiblaLock.js)

  const hasPosition = Boolean(currentLocation);

  // If we have no position yet, try to get one on mount.
  useEffect(() => {
    if (!currentLocation && (locationStatus === "idle" || locationStatus === "error")) {
      locateUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bearing from real coordinates (UNCHANGED math).
  useEffect(() => {
    if (!hasPosition) return;
    const b = qiblaBearing(currentLocation.latitude, currentLocation.longitude);
    setBearing(b);
    bearingRef.current = b;
    let cancelled = false;
    fetchMagneticDeclination(currentLocation.latitude, currentLocation.longitude).then((value) => {
      if (!cancelled) {
        setDeclination(value);
        declinationRef.current = value;
        setDeclinationLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasPosition ? currentLocation.latitude : null, hasPosition ? currentLocation.longitude : null, hasPosition]);

  const pushBeamTarget = (toValue, duration, easing) => {
    Animated.timing(dialAnim, {
      toValue,
      duration,
      easing,
      useNativeDriver: true,
    }).start();
  };

  const lockBeam = () => {
    Animated.timing(lockGlow, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    // Softly ease the beam exactly onto the icon and hold it there.
    const screenAngle = prevScreenAngleRef.current || 0;
    const frozen = freeUnwrappedRef.current + signedDelta(screenAngle, 0);
    pushBeamTarget(frozen, LOCK_ANIM_MS, Easing.out(Easing.cubic));
  };

  const unlockBeam = () => {
    Animated.timing(lockGlow, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  // The whole rotation pipeline. Cheap math only — no setState, so the
  // React tree never re-renders while the compass is live.
  const handleSensorTick = (data) => {
    const bearingNow = bearingRef.current;
    if (bearingNow == null) return;

    // --- direction math (UNCHANGED formulas) ---
    const magnetic = magnetometerToHeading(data);
    const trueHeading =
      declinationRef.current != null
        ? (magnetic + declinationRef.current + 360) % 360
        : magnetic;
    // Where the Qibla beam points ON SCREEN relative to the phone:
    // 0° = straight up, at the Kaaba icon.
    const screenAngle = (bearingNow - trueHeading + 360) % 360;

    // --- unwrapped accumulation (no 0/360 jumps) ---
    const prev = prevScreenAngleRef.current;
    prevScreenAngleRef.current = screenAngle;
    if (prev == null) {
      freeUnwrappedRef.current = screenAngle;
      pushBeamTarget(screenAngle, TRACK_ANIM_MS, Easing.linear);
      if (!lockRef.current) lockRef.current = createLockMachine();
      return;
    }
    freeUnwrappedRef.current += signedDelta(prev, screenAngle);

    // --- lock state machine (pure, unit-tested in Node) ---
    const wasLocked = lockRef.current ? lockRef.current.locked : false;
    const locked = lockRef.current.tick(screenAngle);
    if (!wasLocked && locked) lockBeam(); // just engaged → soft fixation
    if (wasLocked && !locked) unlockBeam(); // released → free tracking

    if (locked) {
      // Locked: the beam is eased onto the icon and held there. The
      // unwrapped tracking above keeps running, so the hand-off back
      // to free movement is seamless.
      return;
    }

    // Free tracking: one native-driven timing per sensor tick.
    pushBeamTarget(freeUnwrappedRef.current, TRACK_ANIM_MS, Easing.linear);
  };

  // Sensor subscription: ONE listener for this screen, removed on
  // unmount. Re-subscribes when the declination arrives so the true
  // north mapping is right.
  useEffect(() => {
    let mounted = true;
    isMagnetometerAvailable().then((available) => {
      if (!mounted) return;
      setSensorAvailable(available);
      if (!available || !hasPosition) return;
      Magnetometer.setUpdateInterval(SENSOR_INTERVAL_MS);
      subscriptionRef.current = Magnetometer.addListener(handleSensorTick);
    });

    return () => {
      mounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPosition, declinationLoaded]);

  // Back guard: never trigger an unhandled GO_BACK; fall back to Home.
  const goBackToHome = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  // Native-driven interpolations (rebuilt only on rare re-renders).
  const rotateDeg = dialAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "1deg"],
  });
  const lockHaloOpacity = lockGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.14],
  });
  const badgeLift = lockGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  const renderCompass = () => {
    if (sensorAvailable === false) {
      return (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sensorTitle, { color: colors.text }]}>
            Датчик ориентации недоступен
          </Text>
          <Text style={[styles.sensorText, { color: colors.textSecondary, textAlign: "center" }]}>
            На этом устройстве нет магнитометра, поэтому показать живой компас невозможно.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.compassWrap}>
        <View style={styles.compass}>
          {/* clean minimalist ring */}
          <View style={[styles.ring, { borderColor: colors.border }]} />

          {/* the light beam — the ONLY moving element (native driver) */}
          <Animated.View style={[styles.beamGroup, { transform: [{ rotate: rotateDeg }] }]}>
            <View style={[styles.beamHalo, { backgroundColor: colors.accent }]} />
            <Animated.View
              style={[
                styles.beamHaloLock,
                { backgroundColor: colors.accent, opacity: lockHaloOpacity },
              ]}
            />
            <View style={[styles.beamSegA, { backgroundColor: colors.accent }]} />
            <View style={[styles.beamSegB, { backgroundColor: colors.accent }]} />
            <View style={[styles.beamSegC, { backgroundColor: colors.accent }]} />
            <View style={[styles.beamSegD, { backgroundColor: colors.accent }]} />
          </Animated.View>

          {/* soft light in the center (static, layered opacities) */}
          <View style={[styles.light1, { backgroundColor: colors.accent }]} />
          <View style={[styles.light2, { backgroundColor: colors.accent }]} />
          <View style={[styles.light3, { backgroundColor: colors.accent }]} />
          <View style={[styles.lightCore, { backgroundColor: colors.accent }]} />

          {/* the Kaaba icon — the fixed target on the ring */}
          <View
            style={[
              styles.kaabaChip,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <View style={styles.kaabaCube}>
              <View style={styles.kaabaBand} />
            </View>
          </View>

          {/* "Кибла" badge — fades in only while locked (native driver) */}
          <Animated.View
            style={[styles.lockBadge, { opacity: lockGlow, transform: [{ translateY: badgeLift }] }]}
            pointerEvents="none"
          >
            <View style={[styles.lockPill, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.lockText, { color: colors.accent }]}>Кибла</Text>
            </View>
          </Animated.View>
        </View>

        <Text style={[styles.compassHint, { color: colors.textSecondary }]}>
          Вращайте телефон, чтобы совместить световой луч с Каабой — в этот момент
          телефон направлен на Киблу
        </Text>
      </View>
    );
  };

  const renderContent = () => {
    if (!hasPosition) {
      if (locationStatus === "locating") {
        return (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.sensorText, { color: colors.textSecondary, marginTop: 10 }]}>
              Определяем ваше местоположение…
            </Text>
          </View>
        );
      }
      return (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Ionicons name="location-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.sensorTitle, { color: colors.text }]}>
            {locationStatus === "denied"
              ? "Доступ к геолокации не предоставлен"
              : "Местоположение недоступно"}
          </Text>
          <Text style={[styles.sensorText, { color: colors.textSecondary, textAlign: "center" }]}>
            Направление на Киблу рассчитывается от вашего текущего местоположения.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={locateUser}
          >
            <Text style={{ color: colors.textOnActive, fontWeight: "700" }}>
              Определить местоположение
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.bearingLabel, { color: colors.textSecondary }]}>
            Направление на Киблу
          </Text>
          <Text style={[styles.bearingValue, { color: colors.text }]}>
            {bearing != null ? `${Math.round(bearing)}°` : "…"}
          </Text>
          <Text style={[styles.bearingSub, { color: colors.textSecondary }]}>
            {declinationLoaded
              ? declination != null
                ? `Магнитное склонение: ${declination >= 0 ? "+" : ""}${declination.toFixed(1)}°`
                : "Магнитное склонение недоступно (используется истинный север)"
              : "Определяем магнитное склонение…"}
          </Text>
        </View>
        {renderCompass()}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackToHome} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Кибла</Text>
      </View>
      <View style={{ flex: 1, padding: 16, alignItems: "center" }}>{renderContent()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  title: { fontSize: 20, fontWeight: "800" },
  card: { borderRadius: 16, padding: 20, alignItems: "center", gap: 6, alignSelf: "stretch" },
  bearingLabel: { fontSize: 13 },
  bearingValue: { fontSize: 44, fontWeight: "800" },
  bearingSub: { fontSize: 12, textAlign: "center" },
  sensorTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  sensorText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  retryButton: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  compassWrap: { alignItems: "center", marginTop: 28 },
  compass: { width: DIAL_SIZE, height: DIAL_SIZE },
  ring: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: DIAL_RADIUS,
    borderWidth: 2,
  },
  beamGroup: { position: "absolute", left: 0, top: 0, width: DIAL_SIZE, height: DIAL_SIZE },
  beamHalo: {
    position: "absolute",
    left: DIAL_RADIUS - 4.5,
    top: 14,
    width: 9,
    height: DIAL_RADIUS - 16,
    borderRadius: 4.5,
    opacity: 0.1,
  },
  beamHaloLock: {
    position: "absolute",
    left: DIAL_RADIUS - 7.5,
    top: 14,
    width: 15,
    height: DIAL_RADIUS - 16,
    borderRadius: 7.5,
  },
  beamSegA: {
    position: "absolute",
    left: DIAL_RADIUS - 1.5,
    top: 46,
    width: 3,
    height: DIAL_RADIUS - 46,
    borderRadius: 1.5,
    opacity: 0.95,
  },
  beamSegB: {
    position: "absolute",
    left: DIAL_RADIUS - 1.5,
    top: 34,
    width: 3,
    height: 14,
    borderRadius: 1.5,
    opacity: 0.72,
  },
  beamSegC: {
    position: "absolute",
    left: DIAL_RADIUS - 1.5,
    top: 22,
    width: 3,
    height: 14,
    borderRadius: 1.5,
    opacity: 0.5,
  },
  beamSegD: {
    position: "absolute",
    left: DIAL_RADIUS - 1.5,
    top: 10,
    width: 3,
    height: 14,
    borderRadius: 1.5,
    opacity: 0.36,
  },
  light1: {
    position: "absolute",
    left: DIAL_RADIUS - 44,
    top: DIAL_RADIUS - 44,
    width: 88,
    height: 88,
    borderRadius: 44,
    opacity: 0.1,
  },
  light2: {
    position: "absolute",
    left: DIAL_RADIUS - 30,
    top: DIAL_RADIUS - 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.16,
  },
  light3: {
    position: "absolute",
    left: DIAL_RADIUS - 19,
    top: DIAL_RADIUS - 19,
    width: 38,
    height: 38,
    borderRadius: 19,
    opacity: 0.26,
  },
  lightCore: {
    position: "absolute",
    left: DIAL_RADIUS - 6,
    top: DIAL_RADIUS - 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    opacity: 0.95,
  },
  kaabaChip: {
    position: "absolute",
    left: DIAL_RADIUS - 16,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  kaabaCube: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: "#15181D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  kaabaBand: { height: 4, marginTop: 4, marginHorizontal: 2, backgroundColor: "#C9A227" },
  lockBadge: { position: "absolute", left: 0, right: 0, bottom: 22, alignItems: "center" },
  lockPill: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 5 },
  lockText: { fontSize: 13, fontWeight: "800", letterSpacing: 0.6 },
  compassHint: { fontSize: 12, marginTop: 18, textAlign: "center", maxWidth: 300 },
});
