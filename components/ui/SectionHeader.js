import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, radii, fonts } from '../../theme/theme';

export default function SectionHeader({
  title,
  fontSize = 28,
  lineHeight,
  onBackPress,
  backAccessibilityLabel = 'Назад',
  cityName = 'Дербент',
  onCityPress,
  onInfoPress,
  infoAccessibilityLabel = 'О разделе',
  style,
  titleStyle,
}) {
  const calculatedLineHeight = lineHeight || (fontSize <= 24 ? 32 : 36);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftGroup}>
        {onBackPress ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBackPress}
            activeOpacity={0.7}
            accessibilityLabel={backAccessibilityLabel}
            accessibilityRole="button"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 19l-7-7 7-7" />
            </Svg>
          </TouchableOpacity>
        ) : null}

        <Text
          style={[
            styles.title,
            { fontSize, lineHeight: calculatedLineHeight },
            titleStyle,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      <View style={styles.actions}>
        {onCityPress ? (
          <TouchableOpacity
            style={styles.cityChip}
            onPress={onCityPress}
            activeOpacity={0.7}
            accessibilityLabel={`Выбрать город: ${cityName}`}
            accessibilityRole="button"
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
              <Circle cx={12} cy={9.5} r={2.5} />
            </Svg>
            <Text style={styles.cityText} numberOfLines={1}>
              {cityName}
            </Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M6 9l6 6 6-6" />
            </Svg>
          </TouchableOpacity>
        ) : null}

        {onInfoPress ? (
          <TouchableOpacity
            style={styles.infoBtn}
            onPress={onInfoPress}
            activeOpacity={0.7}
            accessibilityLabel={infoAccessibilityLabel}
            accessibilityRole="button"
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={12} r={9} />
              <Path d="M12 11v5M12 8v.01" />
            </Svg>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.ui.bold,
    fontSize: 28,
    lineHeight: 36,
    color: colors.text,
    letterSpacing: -0.3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cityChip: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cityText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.text,
  },
  infoBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
