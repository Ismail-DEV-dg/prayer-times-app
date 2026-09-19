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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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

// Qibla screen based on Stitch design (Screen 77d8152544d243e4a4c16171abb544f0).
// Complete with azimuth reading card, cardinal markers, Kaaba target,
// calibration card with infinity symbol (∞), and Quran quote (Al-Baqarah 2:144).
// STRICTLY NO theme selector on this screen.

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

// Cardinal direction helper for azimuth display
function getCardinalDirection(deg) {
  const normalized = (deg % 360 + 360) % 360;
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

  // Native-driven animation values
  const dialAnim = useRef(new Animated.Value(0)).current;
  const lockGlow = useRef(new Animated.Value(0)).current;

  // Mutable refs for high-frequency sensor updates
  const bearingRef = useRef(null);
  const declinationRef = useRef(null);
  const subscriptionRef = useRef(null);
  const lockRef = useRef(null);
  const freeUnwrappedRef = useRef(0);
  const prevScreenAngleRef = useRef(null);
  const lastTickAtRef = useRef(0);

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
    const bearingNow = bearingRef.current;
    if (bearingNow == null) return;

    const now = Date.now();
    const dt = lastTickAtRef.current ? now - lastTickAtRef.current : SENSOR_INTERVAL_MS;
    const trackMs = Math.min(Math.max(dt * 1.5, TRACK_ANIM_MS), TRACK_ANIM_MAX_MS);
    lastTickAtRef.current = now;

    const magnetic = magnetometerToHeading(data);
    const trueHeading =
      declinationRef.current != null
        ? (magnetic + declinationRef.current + 360) % 360
        : magnetic;
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
      };
    }, [])
  );

  const goBackSafe = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const rotateDeg = dialAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "1deg"],
  });
  const lockHaloOpacity = lockGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.18],
  });
  const badgeLift = lockGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  const isGpsActive = Boolean(currentLocation?.fromGps);
  const displayCityName = isLocating
    ? "Поиск GPS…"
    : isGpsActive
    ? currentLocation?.name || "По GPS"
    : selectedCity?.name || "Мекка";
  const azimuthDegree = bearing != null ? Math.round(bearing) : 164;
  const cardinalText = getCardinalDirection(azimuthDegree);

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
        {/* Soft target glow behind dial */}
        <View
          style={[
            styles.targetGlowHalo,
            { backgroundColor: colors.accentSoft || "rgba(56, 189, 248, 0.15)" },
          ]}
        />

        {/* Dial Base & Cardinal Markers */}
        <View style={styles.compass}>
          {/* Static concentric dial ring */}
          <View style={[styles.ring, { borderColor: colors.border }]} />

          {/* Inner decorative concentric circles */}
          <View
            style={[
              styles.innerRing1,
              { borderColor: colors.border, opacity: 0.6 },
            ]}
          />
          <View
            style={[
              styles.innerRing2,
              { borderColor: colors.border, opacity: 0.4 },
            ]}
          />

          {/* Cardinal Typography Labels */}
          <Text style={[styles.cardinalNorth, { color: colors.accent }]}>С</Text>
          <Text style={[styles.cardinalEast, { color: colors.textSecondary }]}>В</Text>
          <Text style={[styles.cardinalSouth, { color: colors.textSecondary }]}>Ю</Text>
          <Text style={[styles.cardinalWest, { color: colors.textSecondary }]}>З</Text>

          {/* Degree values */}
          <Text style={[styles.deg0, { color: colors.textSecondary }]}>0°</Text>
          <Text style={[styles.deg90, { color: colors.textSecondary }]}>90°</Text>
          <Text style={[styles.deg180, { color: colors.textSecondary }]}>180°</Text>
          <Text style={[styles.deg270, { color: colors.textSecondary }]}>270°</Text>

          {/* The light beam — the ONLY moving element (native driver) */}
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

          {/* Soft light in the center (static layered core) */}
          <View style={[styles.light1, { backgroundColor: colors.accent }]} />
          <View style={[styles.light2, { backgroundColor: colors.accent }]} />
          <View style={[styles.light3, { backgroundColor: colors.accent }]} />
          <View style={[styles.lightCore, { backgroundColor: colors.accent }]} />

          {/* Fixed Kaaba Target chip on top of ring */}
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

          {/* Lock confirmation badge */}
          <Animated.View
            style={[
              styles.lockBadge,
              { opacity: lockGlow, transform: [{ translateY: badgeLift }] },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.lockPill, { backgroundColor: colors.accent }]}>
              <Ionicons name="checkmark-circle" size={14} color={colors.textOnActive || "#FFF"} />
              <Text style={[styles.lockText, { color: colors.textOnActive || "#FFF" }]}>
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
      {/* Top Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
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
                name={isGpsActive ? "navigate" : "location-sharp"}
                size={14}
                color={isGpsActive ? colors.accent : colors.textSecondary}
              />
            )}
            <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
              {displayCityName}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.gpsRefreshBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={requestGpsLocation}
            accessibilityLabel="Обновить GPS местоположение"
            disabled={isLocating}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isLocating ? "sync" : "refresh"}
              size={15}
              color={isLocating ? colors.accent : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Center Title (perfectly centered on screen) */}
        <View style={styles.headerTitleContainer} pointerEvents="none">
          <Text style={[styles.headerTitle, { color: colors.text }]}>Кибла</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.infoButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => setInfoModalVisible(true)}
          accessibilityLabel="Справка"
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
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
              <Text style={[styles.permissionBtnText, { color: colors.textOnActive || "#FFF" }]}>
                Включить
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Live GPS status indicator while locating */}
        {isLocating && (
          <View style={styles.gpsSearchingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.gpsSearchingText, { color: colors.accent }]}>
              Определение точных координат GPS…
            </Text>
          </View>
        )}

        {/* Azimuth Reading Card */}
        <View style={styles.azimuthSection}>
          <Text style={[styles.azimuthCaption, { color: colors.textSecondary }]}>
            НАПРАВЛЕНИЕ НА КААБУ
          </Text>
          <View style={styles.azimuthValueRow}>
            <Text style={[styles.azimuthDegrees, { color: colors.text }]}>
              {bearing != null ? `${Math.round(bearing)}°` : "164°"}
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
          <Text style={[styles.calibSymbol, { color: colors.accent }]}>∞</Text>
          <Text style={[styles.calibText, { color: colors.textSecondary }]}>
            Для калибровки компаса сделайте устройством плавное движение «восьмёрка» (∞) в воздухе
          </Text>
        </View>

        {/* Sacred Quran Quote Card (Surah Al-Baqarah 2:144) */}
        <View
          style={[
            styles.quoteCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.quoteIconWrap,
              { backgroundColor: colors.accentSoft || "rgba(13, 148, 136, 0.12)" },
            ]}
          >
            <Ionicons name="book-outline" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.quoteText, { color: colors.text }]}>
              «Поверни же свое лицо в сторону Заповедной мечети...»
            </Text>
            <View style={styles.quoteRefRow}>
              <Text style={[styles.quoteRef, { color: colors.accent }]}>Коран 2:144</Text>
              <View style={[styles.quoteDot, { backgroundColor: colors.textSecondary }]} />
              <Text style={[styles.quoteSurah, { color: colors.textSecondary }]}>
                Аль-Бакара
              </Text>
            </View>
          </View>
        </View>

        {/* Architectural Mosque Silhouette Backdrop (banner variant, strictly NO domes) */}
        <View style={styles.mosqueBackdrop} pointerEvents="none">
          <StitchMosque
            variant="banner"
            idPrefix="qibla"
            colors={colors}
            width="100%"
            height={85}
            preserveAspectRatio="xMidYMax meet"
            showGlow={false}
            opacity={colors.isDark ? 0.65 : 0.45}
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
              <Ionicons name="compass" size={24} color={colors.accent} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>О компасе Киблы</Text>
            </View>
            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
              Компас вычисляет точный географический азимут направления на священную Каабу (Мекка, 21.4225° N, 39.8262° E) с учётом локального магнитного склонения.{"\n\n"}
              Для наибольшей точности держите устройство горизонтально, подальше от металлических предметов и магнитных чехлов.
            </Text>
            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: colors.accent }]}
              onPress={() => setInfoModalVisible(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textOnActive || "#FFF" }]}>
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
  safe: { flex: 1 },
  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 52,
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
  headerLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 2,
    maxWidth: "48%",
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 1,
  },
  gpsRefreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  locationText: {
    fontSize: 12,
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  infoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  permissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
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
  gpsSearchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  gpsSearchingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  azimuthSection: {
    alignItems: "center",
    marginTop: 6,
    marginBottom: 10,
  },
  azimuthCaption: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  azimuthValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 2,
  },
  azimuthDegrees: {
    fontSize: 46,
    fontWeight: "800",
    letterSpacing: -1,
  },
  azimuthCardinal: {
    fontSize: 22,
    fontWeight: "800",
  },
  compassZone: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
    position: "relative",
  },
  targetGlowHalo: {
    position: "absolute",
    width: DIAL_SIZE + 40,
    height: DIAL_SIZE + 40,
    borderRadius: (DIAL_SIZE + 40) / 2,
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
    borderWidth: 2,
  },
  innerRing1: {
    position: "absolute",
    left: 32 + 24,
    top: 32 + 24,
    width: DIAL_SIZE - 48,
    height: DIAL_SIZE - 48,
    borderRadius: (DIAL_SIZE - 48) / 2,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  innerRing2: {
    position: "absolute",
    left: 32 + 54,
    top: 32 + 54,
    width: DIAL_SIZE - 108,
    height: DIAL_SIZE - 108,
    borderRadius: (DIAL_SIZE - 108) / 2,
    borderWidth: 1,
  },
  cardinalNorth: {
    position: "absolute",
    top: 38,
    fontSize: 16,
    fontWeight: "800",
  },
  cardinalEast: {
    position: "absolute",
    right: 40,
    fontSize: 15,
    fontWeight: "700",
  },
  cardinalSouth: {
    position: "absolute",
    bottom: 38,
    fontSize: 15,
    fontWeight: "700",
  },
  cardinalWest: {
    position: "absolute",
    left: 40,
    fontSize: 15,
    fontWeight: "700",
  },
  deg0: {
    position: "absolute",
    top: 56,
    fontSize: 9,
    fontWeight: "600",
  },
  deg90: {
    position: "absolute",
    right: 58,
    fontSize: 9,
    fontWeight: "600",
  },
  deg180: {
    position: "absolute",
    bottom: 56,
    fontSize: 9,
    fontWeight: "600",
  },
  deg270: {
    position: "absolute",
    left: 58,
    fontSize: 9,
    fontWeight: "600",
  },
  beamGroup: {
    position: "absolute",
    left: 32,
    top: 32,
    width: DIAL_SIZE,
    height: DIAL_SIZE,
  },
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
    left: 32 + DIAL_RADIUS - 44,
    top: 32 + DIAL_RADIUS - 44,
    width: 88,
    height: 88,
    borderRadius: 44,
    opacity: 0.1,
  },
  light2: {
    position: "absolute",
    left: 32 + DIAL_RADIUS - 30,
    top: 32 + DIAL_RADIUS - 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.16,
  },
  light3: {
    position: "absolute",
    left: 32 + DIAL_RADIUS - 19,
    top: 32 + DIAL_RADIUS - 19,
    width: 38,
    height: 38,
    borderRadius: 19,
    opacity: 0.26,
  },
  lightCore: {
    position: "absolute",
    left: 32 + DIAL_RADIUS - 6,
    top: 32 + DIAL_RADIUS - 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    opacity: 0.95,
  },
  kaabaChip: {
    position: "absolute",
    left: 32 + DIAL_RADIUS - 16,
    top: 32 + 12,
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
  kaabaBand: {
    height: 4,
    marginTop: 4,
    marginHorizontal: 2,
    backgroundColor: "#C9A227",
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
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  lockText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  calibrationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    width: "100%",
  },
  calibSymbol: {
    fontSize: 22,
    fontWeight: "800",
  },
  calibText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  quoteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginTop: 10,
    width: "100%",
  },
  quoteIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quoteText: {
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
  },
  quoteRefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  quoteRef: {
    fontSize: 11,
    fontWeight: "700",
  },
  quoteDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  quoteSurah: {
    fontSize: 11,
  },
  mosqueBackdrop: {
    width: "100%",
    height: 85,
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 8,
    overflow: "hidden",
  },
  card: {
    borderRadius: 16,
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
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
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
