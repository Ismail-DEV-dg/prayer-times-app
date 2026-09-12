import React from "react";
import { Stack } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";

// /settings stack: index (full settings) + sub-screens (theme, method).
// Same soft transition style as the root stack for visual consistency.
export default function SettingsStackLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "fade_from_bottom",
        animationDuration: 320,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="theme" />
      <Stack.Screen name="method" />
    </Stack>
  );
}
