import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, fonts } from '../../theme/theme';

export default function Pill({
  showDot = true,
  dotColor = colors.accent,
  label,
  children,
  style,
  textStyle,
  ...props
}) {
  return (
    <View style={[styles.pill, style]} {...props}>
      {showDot && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
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
    color: colors.text,
  },
});
