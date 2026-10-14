import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radii } from '../../theme/theme';

export default function ListRow({
  active = false,
  style,
  children,
  onPress,
  accessibilityLabel,
  ...props
}) {
  const rowStyle = [
    styles.row,
    active ? styles.rowActive : styles.rowInactive,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={rowStyle}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={rowStyle} accessibilityLabel={accessibilityLabel} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 54,
    borderRadius: radii.row,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    boxSizing: 'border-box',
  },
  rowInactive: {
    backgroundColor: 'transparent',
    borderColor: colors.borderSoft,
  },
  rowActive: {
    backgroundColor: colors.surfaceActive,
    borderColor: colors.accent,
  },
});
