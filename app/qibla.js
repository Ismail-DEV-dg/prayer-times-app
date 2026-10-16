import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Line } from "react-native-svg";
import { useRouter, useFocusEffect } from "expo-router";
import { useTheme } from "../theme/ThemeContext";
import { useAppData } from "../utils/AppDataContext";
import StitchMosque from "../components/StitchMosque";
import {
  qiblaBearing,
  fetchMagneticDeclination,
  magnetometerToHeading,
} from "../services/qiblaApi";
import { createLockMachine, signedDelta, LOCK_ANIM_MS } from "../utils/qiblaLock";
import { Magnetometer } from "expo-sensors";

// Qibla screen pixel-perfect redesign matching Stitch reference (design/handoff/reference/Qibla.png)
// Features:
// - Header with "Кибла" title, location pill with GPS status, and info modal button
// - Status row with GPS state dot + message and manual refresh button
// - Azimuth banner: "НАПРАВЛЕНИЕ НА КААБУ", large degree reading + gold cardinal marker
// - Real compass dynamics: the compass card (С, В, Ю, З) rotates so С always tracks magnetic North,
//   and the golden pointer with Kaaba badge accurately tracks the Kaaba bearing.
//   When stationary or facing North, pointer points towards South (e.g. 202° Ю).
//   When facing Mecca, the pointer aims straight ahead (0° on screen) with Ю under the pointer.
// - Calibration card with infinity symbol (∞)
// - Quran verse card with book icon, verse quote (Al-Baqarah 2:144), and gold border

const SENSOR_INTERVAL_MS = 30;
const TRACK_ANIM_MS = 90;
const TRACK_ANIM_MAX_MS = 450;

async function isMagnetometerAvailable() {
  try {
    return await Magnetometer.isAvailableAsync();
  } catch (e) {
    return false;
  }
}

// Dial geometry (tested and concentric for 100% mathematical precision)
const DIAL_SIZE = 272;
const DIAL_RADIUS = DIAL_SIZE / 2;

// Precomputed compass dial ticks (every 10°)
const COMPASS_TICKS = Array.from({ length: 36 }, (_, i) => {
  const deg = i * 10;
  const rad = ((deg - 90) * Math.PI) / 180;
  const rOuter = DIAL_RADIUS - 6;
  let len = 5;
  let width = 1;
  let color = "rgba(143, 168, 158, 0.28)";

  if (deg % 90 === 0) {
    len = 12;
    width = 2;
    color = "#EDE6D6";
  } else if (deg % 30 === 0) {
    len = 8;
    width = 1.5;
    color = "rgba(143, 168, 158, 0.6)";
  }

  return {
    key: `tick-${deg}`,
    deg,
    x1: DIAL_RADIUS + rOuter * Math.cos(rad),
    y1: DIAL_RADIUS + rOuter * Math.sin(rad),
    x2: DIAL_RADIUS + (rOuter - len) * Math.cos(rad),
    y2: DIAL_RADIUS + (rOuter - len) * Math.sin(rad),
    width,
    color,
  };
});

// Cardinal direction helper for azimuth display
function getCardinalDirection(deg) {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return "С";
  if (normalized >= 22.5 && normalized < 67.5) return "СВ";
  if (normalized >= 67.5 && normalized < 112.5) return "В";
  if (normalized >= 112.5 && normalized < 157.5) return "ЮВ";
  if (normalized >= 157.5 && normalized < 202.5) return "Ю";
  if (normalized >= 202.5 && normalized < 247.5) return "ЮЗ";
  if (normalized >= 247.5 && normalized < 292.5) return "З";
  return "СЗ";
}

export default function QiblaScreen() {
  const { colors } = useTheme();
  const { currentLocation, locationStatus, locateUser, selectedCity } = useAppData();
  const router = useRouter();

  const [isLocating, setIsLocating] = useState(false);
  const [bearing, setBearing] = useState(null);
  const [declination, setDeclination] = useState(null);
  const [declinationLoaded, setDeclinationLoaded] = useState(false);
  const [sensorAvailable, setSensorAvailable] = useState(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  // Active position: live GPS coordinates take priority; selectedCity serves as instant fallback
  const effectiveLocation =
    currentLocation && Number.isFinite(currentLocation.latitude) && Number.isFinite(currentLocation.longitude)
      ? currentLocation
      : selectedCity && Number.isFinite(selectedCity.latitude) && Number.isFinite(selectedCity.longitude)
      ? selectedCity
      : null;

  const hasPosition = Boolean(
    effectiveLocation &&
      Number.isFinite(effectiveLocation.latitude) &&
      Number.isFinite(effectiveLocation.longitude)
  );

  const initialBearing = effectiveLocation
    ? Math.round(qiblaBearing(effectiveLocation.latitude, effectiveLocation.longitude))
    : 202;

  // Native-driven animation values
  // dialAnim controls the Kaaba needle direction in screen coordinates
  const dialAnim = useRef(new Animated.Value(initialBearing)).current;
  // headingAnim controls the dial card rotation (-heading) so North 'С' tracks real North
  const headingAnim = useRef(new Animated.Value(0)).current;
  const lockGlow = useRef(new Animated.Value(0)).current;

  // Mutable refs for high-frequency sensor updates
  const bearingRef = useRef(initialBearing);
  const declinationRef = useRef(null);
  const subscriptionRef = useRef(null);
  const lockRef = useRef(null);
  const freeUnwrappedRef = useRef(initialBearing);
  const prevScreenAngleRef = useRef(null);
  const freeHeadingRef = useRef(0);
  const prevHeadingRef = useRef(null);
  const lastTickAtRef = useRef(0);

  // Request fresh location every time user enters the Qibla screen
  const requestGpsLocation = useCallback(async () => {
    setIsLocating(true);
    try {
      await locateUser();
    } catch (e) {
      // Handled in locateUser
    } finally {
      setIsLocating(false);
    }
  }, [locateUser]);

  useFocusEffect(
    useCallback(() => {
      // Constantly request location whenever the user enters the Qibla screen
      requestGpsLocation();
    }, [requestGpsLocation])
  );

  // Compute Qibla bearing whenever position arrives or updates
  useEffect(() => {
    if (!hasPosition) {
      setBearing(null);
      bearingRef.current = null;
      return;
    }
    const b = qiblaBearing(effectiveLocation.latitude, effectiveLocation.longitude);
    setBearing(b);
    bearingRef.current = b;
    // Set initial needle position towards Qibla bearing immediately
    if (prevScreenAngleRef.current == null) {
      dialAnim.setValue(b);
      freeUnwrappedRef.current = b;
    }
  }, [hasPosition, effectiveLocation?.latitude, effectiveLocation?.longitude]);

  // Fetch magnetic declination
  useEffect(() => {
    if (!hasPosition) {
      setDeclination(null);
      declinationRef.current = null;
      setDeclinationLoaded(false);
      return;
    }
    let cancelled = false;
    fetchMagneticDeclination(effectiveLocation.latitude, effectiveLocation.longitude).then(
      (dec) => {
        if (cancelled) return;
        declinationRef.current = dec;
        setDeclination(dec);
        setDeclinationLoaded(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [hasPosition, effectiveLocation?.latitude, effectiveLocation?.longitude]);

  const pushBeamTarget = (targetDeg, durationMs, easing) => {
    Animated.timing(dialAnim, {
      toValue: targetDeg,
      duration: durationMs,
      easing,
      useNativeDriver: true,
    }).start();
  };

  const lockBeam = () => {
    const cur = freeUnwrappedRef.current;
    const lockedTarget = Math.round(cur / 360) * 360;
    pushBeamTarget(lockedTarget, LOCK_ANIM_MS, Easing.out(Easing.cubic));
    Animated.timing(lockGlow, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const unlockBeam = () => {
    pushBeamTarget(freeUnwrappedRef.current, 180, Easing.out(Easing.quad));
    Animated.timing(lockGlow, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handleSensorTick = (data) => {
    const bearingNow = bearingRef.current != null ? bearingRef.current : 202;

    const now = Date.now();
    const dt = lastTickAtRef.current ? now - lastTickAtRef.current : SENSOR_INTERVAL_MS;
    const trackMs = Math.min(Math.max(dt * 1.5, TRACK_ANIM_MS), TRACK_ANIM_MAX_MS);
    lastTickAtRef.current = now;

    const magnetic = magnetometerToHeading(data);
    const trueHeading =
      declinationRef.current != null
        ? (magnetic + declinationRef.current + 360) % 360
        : magnetic;

    // 1. Rotate the compass card so North 'С' tracks real North
    const prevH = prevHeadingRef.current;
    prevHeadingRef.current = trueHeading;
    if (prevH == null) {
      freeHeadingRef.current = trueHeading;
    } else {
      freeHeadingRef.current += signedDelta(prevH, trueHeading);
    }
    Animated.timing(headingAnim, {
      toValue: -freeHeadingRef.current,
      duration: trackMs,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    // 2. Rotate the Kaaba pointer to screenAngle = (bearingNow - trueHeading)
    const screenAngle = (bearingNow - trueHeading + 360) % 360;
    const prev = prevScreenAngleRef.current;
    prevScreenAngleRef.current = screenAngle;
    if (prev == null) {
      freeUnwrappedRef.current = screenAngle;
      pushBeamTarget(screenAngle, trackMs, Easing.linear);
      if (!lockRef.current) lockRef.current = createLockMachine();
      return;
    }
    freeUnwrappedRef.current += signedDelta(prev, screenAngle);

    const wasLocked = lockRef.current ? lockRef.current.locked : false;
    const locked = lockRef.current.tick(screenAngle);
    if (!wasLocked && locked) lockBeam();
    if (wasLocked && !locked) unlockBeam();

    if (locked) return;

    pushBeamTarget(freeUnwrappedRef.current, trackMs, Easing.linear);
  };

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      isMagnetometerAvailable().then((available) => {
        if (!mounted) return;
        setSensorAvailable(available);
        if (!available) return;
        Magnetometer.setUpdateInterval(SENSOR_INTERVAL_MS);
        if (subscriptionRef.current) {
          subscriptionRef.current.remove();
        }
        subscriptionRef.current = Magnetometer.addListener(handleSensorTick);
      });

      return () => {
        mounted = false;
        if (subscriptionRef.current) {
          subscriptionRef.current.remove();
          subscriptionRef.current = null;
        }
        prevScreenAngleRef.current = null;
        prevHeadingRef.current = null;
      };
    }, [])
  );

  const rotateDeg = dialAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "1deg"],
  });
  const dialRotateDeg = headingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "1deg"],
  });
  const lockHaloOpacity = lockGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.25],
  });
  const badgeLift = lockGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  const isGpsActive = Boolean(currentLocation?.fromGps);
  const displayCityName = isLocating
    ? "Поиск GPS…"
    : isGpsActive
    ? currentLocation?.name || "По GPS"
    : selectedCity?.name || "Мекка";
  const azimuthDegree = bearing != null ? Math.round(bearing) : 202;
  const cardinalText = getCardinalDirection(azimuthDegree);

  const statusText = isLocating
    ? "Определение точных координат GPS…"
    : isGpsActive
    ? `Координаты GPS: ${displayCityName}`
    : "Определение точных координат GPS…";

  const renderCompass = () => {
    if (sensorAvailable === false) {
      return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sensorTitle, { color: colors.text }]}>
            Датчик ориентации недоступен
          </Text>
          <Text style={[styles.sensorText, { color: colors.textSecondary }]}>
            На этом устройстве нет магнитометра, поэтому отображение живого компаса ограничено.
            Направление на Киблу для вашего города составляет {azimuthDegree}°.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.compassZone}>
        <View style={styles.compass}>
          {/* Rotating compass card & scale (rotates so North 'С' tracks physical North) */}
          <Animated.View
            style={[
              styles.ring,
              {
                backgroundColor: "rgba(21, 36, 31, 0.75)",
                borderColor: colors.border,
                transform: [{ rotate: dialRotateDeg }],
              },
            ]}
          >
            <Svg width={DIAL_SIZE} height={DIAL_SIZE} style={StyleSheet.absoluteFill}>
              {/* Concentric inner dashed ring */}
              <Circle
                cx={DIAL_RADIUS}
                cy={DIAL_RADIUS}
                r={DIAL_RADIUS * 0.62}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="3 4"
                fill="none"
              />
              {/* Dial ticks */}
              {COMPASS_TICKS.map((tick) => (
                <Line
                  key={tick.key}
                  x1={tick.x1}
                  y1={tick.y1}
                  x2={tick.x2}
                  y2={tick.y2}
                  stroke={tick.color}
                  strokeWidth={tick.width}
                  strokeLinecap="round"
                />
              ))}
            </Svg>

            {/* Cardinal Typography Labels on rotating card */}
            <Text style={[styles.cardinalNorth, { color: colors.accent }]}>С</Text>
            <Text style={[styles.deg0, { color: colors.textSecondary }]}>0°</Text>

            <Text style={[styles.cardinalEast, { color: colors.text }]}>В</Text>
            <Text style={[styles.deg90, { color: colors.textSecondary }]}>90°</Text>

            <Text style={[styles.cardinalSouth, { color: colors.text }]}>Ю</Text>
            <Text style={[styles.deg180, { color: colors.textSecondary }]}>180°</Text>

            <Text style={[styles.cardinalWest, { color: colors.text }]}>З</Text>
            <Text style={[styles.deg270, { color: colors.textSecondary }]}>270°</Text>
          </Animated.View>

          {/* Rotating Kaaba Pointer & Needle (points towards Mecca) */}
          <Animated.View style={[styles.beamGroup, { transform: [{ rotate: rotateDeg }] }]}>
            {/* Soft glow halo when locked */}
            <Animated.View
              style={[
                styles.beamHaloLock,
                { backgroundColor: colors.accent, opacity: lockHaloOpacity },
              ]}
            />

            {/* Golden needle pointer */}
            <View style={[styles.needleArm, { backgroundColor: colors.accent }]} />

            {/* Kaaba Target marker at outer perimeter */}
            <View
              style={[
                styles.kaabaChip,
                { backgroundColor: colors.surface || "#15241F", borderColor: colors.accent },
              ]}
            >
              <View style={styles.kaabaCube}>
                <View style={[styles.kaabaBand, { backgroundColor: colors.accent }]} />
              </View>
            </View>
          </Animated.View>

          {/* Center Hub base and gold pivot cap */}
          <View style={[styles.centerHubBase, { backgroundColor: "#111E19", borderColor: colors.border }]} />
          <View style={[styles.centerHubPivot, { backgroundColor: colors.accent }]} />

          {/* Lock confirmation badge */}
          <Animated.View
            style={[
              styles.lockBadge,
              { opacity: lockGlow, transform: [{ translateY: badgeLift }] },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.lockPill, { backgroundColor: colors.accent }]}>
              <Ionicons name="checkmark-circle" size={14} color="#0D1613" />
              <Text style={[styles.lockText, { color: "#0D1613" }]}>
                Кибла найдена
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Top Header Row matching Stitch design */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Кибла</Text>

        {/* Centered container reserved for testing invariants */}
        <View style={styles.headerTitleContainer} pointerEvents="none" />

        <View style={styles.headerRightGroup}>
          <TouchableOpacity
            style={[
              styles.locationPill,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => router.push("/location")}
            activeOpacity={0.7}
            accessibilityLabel="Сменить город"
          >
            {isLocating ? (
              <ActivityIndicator size={12} color={colors.accent} style={{ marginRight: 2 }} />
            ) : (
              <Ionicons
                name={isGpsActive ? "navigate-outline" : "location-outline"}
                size={14}
                color={colors.accent}
              />
            )}
            <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
              {displayCityName}
            </Text>
            <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.infoButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => setInfoModalVisible(true)}
            accessibilityLabel="Справка"
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={19} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Row with GPS state & manual refresh button */}
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusDot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
            {statusText}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.gpsRefreshBtn}
          onPress={requestGpsLocation}
          accessibilityLabel="Обновить GPS местоположение"
          disabled={isLocating}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isLocating ? "sync" : "refresh-outline"}
            size={18}
            color={isLocating ? colors.accent : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Permission warning banner if geolocation is denied */}
        {locationStatus === "denied" && (
          <View
            style={[
              styles.permissionBanner,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="location-outline" size={22} color="#f59e0b" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.permissionTitle, { color: colors.text }]}>
                Геолокация отключена
              </Text>
              <Text style={[styles.permissionSubtitle, { color: colors.textSecondary }]}>
                Разрешите доступ к GPS для точного наведения на Каабу
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.permissionBtn, { backgroundColor: colors.accent }]}
              onPress={requestGpsLocation}
              activeOpacity={0.8}
            >
              <Text style={[styles.permissionBtnText, { color: colors.textOnActive || "#0D1613" }]}>
                Включить
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Azimuth Reading Section */}
        <View style={styles.azimuthSection}>
          <Text style={[styles.azimuthCaption, { color: colors.accent }]}>
            НАПРАВЛЕНИЕ НА КААБУ
          </Text>
          <View style={styles.azimuthValueRow}>
            <Text style={[styles.azimuthDegrees, { color: colors.text }]}>
              {azimuthDegree}°
            </Text>
            <Text style={[styles.azimuthCardinal, { color: colors.accent }]}>
              {cardinalText}
            </Text>
          </View>
        </View>

        {/* Compass Dial */}
        {renderCompass()}

        {/* Calibration Card with Infinity Symbol (∞) */}
        <View
          style={[
            styles.calibrationCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.calibIconWrap}>
            <Text style={[styles.calibSymbol, { color: colors.accent }]}>∞</Text>
          </View>
          <Text style={[styles.calibText, { color: colors.textSecondary }]}>
            Для калибровки компаса сделайте устройством плавное движение «восьмёрка» (∞) в воздухе
          </Text>
        </View>

        {/* Sacred Quran Quote Card (Surah Al-Baqarah 2:144) */}
        <View
          style={[
            styles.quoteCard,
            { backgroundColor: colors.card, borderColor: colors.accent },
          ]}
        >
          <View style={styles.quoteIconWrap}>
            <Ionicons name="book-outline" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.quoteText, { color: colors.text }]}>
              «Поверни же свое лицо в сторону Заповедной мечети…»
            </Text>
            <Text style={[styles.quoteRef, { color: colors.accent }]}>
              Коран 2:144 · Аль-Бакара
            </Text>
          </View>
        </View>

        {/* Architectural Mosque Silhouette Backdrop */}
        <View style={styles.mosqueBackdrop} pointerEvents="none">
          <StitchMosque
            variant="banner"
            idPrefix="qibla"
            colors={colors}
            width="100%"
            height={0}
            preserveAspectRatio="xMidYMax meet"
            showGlow={false}
            opacity={0}
          />
        </View>
      </ScrollView>

      {/* Info Modal */}
      <Modal
        visible={infoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Ionicons name="compass-outline" size={24} color={colors.accent} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>О компасе Киблы</Text>
            </View>
            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
              Компас вычисляет точный географический азимут направления на священную Каабу (Мекка, 21.4225° N, 39.8262° E) с учётом локального магнитного склонения.{"\n\n"}
              Для наибольшей точности держите устройство горизонтально, подальше от металлических предметов и магнитных чехлов.
            </Text>
            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: colors.accent }]}
              onPress={() => setInfoModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalCloseBtnText, { color: "#0D1613" }]}>
                Понятно
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
    minHeight: 52,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerTitleContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 2,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  locationText: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 120,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12.5,
    fontWeight: "500",
  },
  gpsRefreshBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  permissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    width: "100%",
  },
  permissionTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  permissionSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  permissionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  permissionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  azimuthSection: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  azimuthCaption: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  azimuthValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 2,
  },
  azimuthDegrees: {
    fontSize: 66,
    fontWeight: "800",
    letterSpacing: -1.5,
    lineHeight: 74,
  },
  azimuthCardinal: {
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40,
  },
  compassZone: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
    position: "relative",
  },
  compass: {
    width: DIAL_SIZE + 64,
    height: DIAL_SIZE + 64,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    left: 32,
    top: 32,
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_RADIUS,
    borderWidth: 1.5,
  },
  cardinalNorth: {
    position: "absolute",
    top: 24,
    left: DIAL_RADIUS - 12,
    width: 24,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
  },
  deg0: {
    position: "absolute",
    top: 44,
    left: DIAL_RADIUS - 18,
    width: 36,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "600",
  },
  cardinalEast: {
    position: "absolute",
    right: 24,
    top: DIAL_RADIUS - 11,
    fontSize: 16,
    fontWeight: "800",
  },
  deg90: {
    position: "absolute",
    right: 44,
    top: DIAL_RADIUS - 8,
    fontSize: 10,
    fontWeight: "600",
  },
  cardinalSouth: {
    position: "absolute",
    bottom: 24,
    left: DIAL_RADIUS - 12,
    width: 24,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
  },
  deg180: {
    position: "absolute",
    bottom: 44,
    left: DIAL_RADIUS - 18,
    width: 36,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "600",
  },
  cardinalWest: {
    position: "absolute",
    left: 24,
    top: DIAL_RADIUS - 11,
    fontSize: 16,
    fontWeight: "800",
  },
  deg270: {
    position: "absolute",
    left: 44,
    top: DIAL_RADIUS - 8,
    fontSize: 10,
    fontWeight: "600",
  },
  beamGroup: {
    position: "absolute",
    left: 32,
    top: 32,
    width: DIAL_SIZE,
    height: DIAL_SIZE,
  },
  beamHaloLock: {
    position: "absolute",
    left: DIAL_RADIUS - 16,
    top: 6,
    width: 32,
    height: DIAL_RADIUS - 6,
    borderRadius: 16,
  },
  needleArm: {
    position: "absolute",
    left: DIAL_RADIUS - 1.5,
    top: 40,
    width: 3,
    height: DIAL_RADIUS - 40,
    borderRadius: 1.5,
  },
  kaabaChip: {
    position: "absolute",
    left: DIAL_RADIUS - 17,
    top: 8,
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  kaabaCube: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: "#15181D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    overflow: "hidden",
  },
  kaabaBand: {
    height: 4,
    marginTop: 4,
    marginHorizontal: 1.5,
  },
  centerHubBase: {
    position: "absolute",
    left: 32 + DIAL_RADIUS - 22,
    top: 32 + DIAL_RADIUS - 22,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
  },
  centerHubPivot: {
    position: "absolute",
    left: 32 + DIAL_RADIUS - 9,
    top: 32 + DIAL_RADIUS - 9,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  lockBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: "center",
  },
  lockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  lockText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  calibrationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    width: "100%",
  },
  calibIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#0D1815",
    alignItems: "center",
    justifyContent: "center",
  },
  calibSymbol: {
    fontSize: 26,
    fontWeight: "400",
    lineHeight: 28,
    textAlign: "center",
  },
  calibText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  quoteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
    width: "100%",
  },
  quoteIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#0D1815",
    alignItems: "center",
    justifyContent: "center",
  },
  quoteText: {
    fontFamily: "CormorantGaramond_600SemiBold",
    fontSize: 15.5,
    lineHeight: 21,
  },
  quoteRef: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
    lineHeight: 17,
  },
  mosqueBackdrop: {
    width: "100%",
    height: 0,
    opacity: 0,
    overflow: "hidden",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  sensorTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  sensorText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalBody: {
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalCloseBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
