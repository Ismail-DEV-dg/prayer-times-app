import React, { useEffect, useState, useRef, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "../theme/ThemeContext";
import { useAppData } from "../utils/AppDataContext";
import {
  qiblaBearing,
  fetchMagneticDeclination,
  magnetometerToHeading,
  circularSmooth,
} from "../services/qiblaApi";
import { Magnetometer } from "expo-sensors";

// Compass tuning. The sensor listener NEVER calls setState directly:
// it only updates a ref, and a single interval commits the smoothed
// value to React at a fixed rate. This keeps renders low and removes
// the jitter/lag of the previous implementation.
const SENSOR_INTERVAL_MS = 100; // raw sensor rate (only writes a ref)
const COMMIT_INTERVAL_MS = 100; // React re-render rate
const SMOOTHING_ALPHA = 0.25; // 0..1: higher = snappier, lower = calmer

// Whether this device exposes a magnetometer (needed for a live
// compass). Never fakes availability.
async function isMagnetometerAvailable() {
  try {
    return await Magnetometer.isAvailableAsync();
  } catch (e) {
    return false;
  }
}

// Qibla screen. The direction is computed from the user's CURRENT GPS
// location — never from the selected city. Without a magnetometer we
// honestly show the computed bearing angle only, no fake compass.
export default function QiblaScreen() {
  const { colors } = useAppTheme();
  const { currentLocation, locationStatus, locateUser } = useAppData();
  const router = useRouter();

  const [bearing, setBearing] = useState(null);
  const [declination, setDeclination] = useState(null);
  const [declinationLoaded, setDeclinationLoaded] = useState(false);
  const [sensorAvailable, setSensorAvailable] = useState(null); // null = checking
  const [heading, setHeading] = useState(null);

  const subscriptionRef = useRef(null);
  const commitTimerRef = useRef(null);
  const latestHeadingRef = useRef(null); // last raw (true) heading
  const smoothHeadingRef = useRef(null); // smoothed heading

  const hasPosition = Boolean(currentLocation);

  // If we have no position yet, try to get one on mount.
  useEffect(() => {
    if (!currentLocation && (locationStatus === "idle" || locationStatus === "error")) {
      locateUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bearing from real coordinates.
  useEffect(() => {
    if (!hasPosition) return;
    setBearing(qiblaBearing(currentLocation.latitude, currentLocation.longitude));
    let cancelled = false;
    fetchMagneticDeclination(currentLocation.latitude, currentLocation.longitude).then((value) => {
      if (!cancelled) {
        setDeclination(value);
        setDeclinationLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasPosition ? currentLocation.latitude : null, hasPosition ? currentLocation.longitude : null, hasPosition]);

  // Sensor subscription: ONE listener for this screen, removed on
  // unmount. The callback only writes a ref — no setState, no object
  // churn. A separate timer commits the circular-smoothed heading to
  // React at a fixed, modest rate.
  useEffect(() => {
    let mounted = true;
    isMagnetometerAvailable().then((available) => {
      if (!mounted) return;
      setSensorAvailable(available);
      if (!available || !hasPosition) return;
      Magnetometer.setUpdateInterval(SENSOR_INTERVAL_MS);
      subscriptionRef.current = Magnetometer.addListener((data) => {
        const magnetic = magnetometerToHeading(data);
        const trueHeading = declination != null ? (magnetic + declination + 360) % 360 : magnetic;
        latestHeadingRef.current = trueHeading;
      });
    });

    commitTimerRef.current = setInterval(() => {
      const target = latestHeadingRef.current;
      if (target == null) return;
      const current = smoothHeadingRef.current;
      // Circular smoothing: shortest-arc step, correct across 0/360.
      smoothHeadingRef.current =
        current == null ? target : circularSmooth(current, target, SMOOTHING_ALPHA);
      setHeading(smoothHeadingRef.current);
    }, COMMIT_INTERVAL_MS);

    return () => {
      mounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      if (commitTimerRef.current) {
        clearInterval(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      latestHeadingRef.current = null;
      smoothHeadingRef.current = null;
    };
    // Re-subscribe when declination changes so true-north mapping is right.
  }, [hasPosition, declinationLoaded]);

  // Compass rotation: the dial shows north at -heading degrees. When
  // the phone heading equals the qibla bearing, the qibla marker sits
  // exactly at the top pointer.
  const dialRotation = heading != null ? -heading : 0;
  // Marker position on the rotating dial: at the qibla bearing angle.
  const markerAngle = bearing != null ? bearing : 0;

  // Back guard: never trigger an unhandled GO_BACK; fall back to Home.
  const goBackToHome = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  // ---- 360-degree dial: ticks every 5, majors every 30, labels ----
  // Built once per color change — NOT on every sensor commit.
  const dialSize = 280;
  const radius = dialSize / 2 - 26; // labels inside the ticks
  const ticks = useMemo(() => {
    const out = [];
    for (let deg = 0; deg < 360; deg += 5) {
      const major = deg % 30 === 0;
      const angleRad = ((deg - 90) * Math.PI) / 180; // 0° at top
      const x = radius * Math.cos(angleRad);
      const y = radius * Math.sin(angleRad);
      out.push(
        <View
          key={`t${deg}`}
          style={[
            styles.tick,
            {
              width: major ? 2.5 : 1,
              height: major ? 16 : 9,
              backgroundColor: major ? colors.text : colors.textSecondary,
              opacity: major ? 0.95 : 0.55,
              transform: [{ translateX: x }, { translateY: y }, { rotate: `${deg}deg` }],
            },
          ]}
        />
      );
      if (major) {
        // Label sits slightly inside the major tick.
        const labelRadius = radius - 24;
        const lx = labelRadius * Math.cos(angleRad);
        const ly = labelRadius * Math.sin(angleRad);
        out.push(
          <Text
            key={`l${deg}`}
            style={[
              styles.tickLabel,
              { color: colors.textSecondary },
              { transform: [{ translateX: lx }, { translateY: ly }] },
            ]}
          >
            {deg === 0 ? "N" : `${deg}°`}
          </Text>
        );
      }
    }
    return out;
  }, [colors.text, colors.textSecondary]);

  // Qibla marker on the dial (green), at the qibla bearing angle.
  const markerRad = ((markerAngle - 90) * Math.PI) / 180;
  const markerR = radius + 10;
  const markerX = markerR * Math.cos(markerRad);
  const markerY = markerR * Math.sin(markerRad);

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
    const aligned =
      bearing != null && heading != null && Math.abs(((bearing - heading + 540) % 360) - 180) < 3;
    return (
      <View style={styles.compassWrap}>
        <View style={styles.indicatorWrap}>
          <View style={[styles.indicator, { backgroundColor: colors.accent }]} />
        </View>
        <View style={[styles.compassOuter, { borderColor: colors.border }]}>
          {/* rotating dial with ticks + qibla marker */}
          <View style={[styles.dial, { width: dialSize, height: dialSize, transform: [{ rotate: `${dialRotation}deg` }] }]}>
            {ticks}
            <View
              style={[
                styles.qiblaMarker,
                {
                  backgroundColor: "#22A06B",
                  transform: [{ translateX: markerX }, { translateY: markerY }, { rotate: `${markerAngle}deg` }],
                },
              ]}
            />
            {/* N marker at 0 degrees of the dial */}
            <View
              style={[
                styles.northMarker,
                { backgroundColor: colors.danger, transform: [{ translateY: -radius - 10 }] },
              ]}
            />
          </View>
          <View style={[styles.compassCenter, { backgroundColor: colors.textSecondary }]} />
          {aligned && (
            <View style={styles.alignedBadge}>
              <Text style={styles.alignedText}>Кыбла</Text>
            </View>
          )}
        </View>
        <Text style={[styles.compassHint, { color: colors.textSecondary }]}>
          Поверните устройство: когда зелёная метка совпадёт с верхним указателем, телефон направлен на Кыблу
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
            Направление на Кыблу рассчитывается от вашего текущего местоположения.
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
            Направление на Кыблу
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
        <Text style={[styles.title, { color: colors.text }]}>Кыбла</Text>
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
  indicatorWrap: { alignItems: "center" },
  indicator: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginBottom: 2,
  },
  compassOuter: {
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dial: { position: "relative", alignItems: "center", justifyContent: "center" },
  tick: { position: "absolute" },
  tickLabel: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "transparent",
  },
  qiblaMarker: {
    position: "absolute",
    width: 5,
    height: 20,
    borderRadius: 3,
  },
  northMarker: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  compassCenter: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  alignedBadge: {
    position: "absolute",
    bottom: 40,
    backgroundColor: "#22A06B",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  alignedText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  compassHint: { fontSize: 12, marginTop: 14, textAlign: "center", maxWidth: 300 },
});
