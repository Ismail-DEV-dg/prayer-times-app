import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../../theme/theme';

export default function Card({ style, children, ...props }) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
  },
});
