import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, AccessibilityInfo } from 'react-native';
import { colors, radii, fonts } from '../../theme/theme';

export default function Pill({
  showDot = true,
  dotColor = colors.accent,
  blink = false,
  label,
  children,
  style,
  textStyle,
  ...props
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setReduceMotion(enabled);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled)
    );

    return () => {
      isMounted = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!blink || reduceMotion) {
      opacity.setValue(1);
      return;
    }

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    anim.start();

    return () => {
      anim.stop();
    };
  }, [blink, reduceMotion]);

  return (
    <View style={[styles.pill, style]} {...props}>
      {showDot && (
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: dotColor, opacity: blink && !reduceMotion ? opacity : 1 },
          ]}
        />
      )}
      {label ? (
        <Text style={[styles.text, textStyle]}>{label}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: colors.bg,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
});
