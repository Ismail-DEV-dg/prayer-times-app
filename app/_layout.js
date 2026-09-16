import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useAppTheme } from "../theme/ThemeContext";
import { AppDataProvider } from "../utils/AppDataContext";
import BootSplash from "../components/BootSplash";

// Pin the root stack's initial route to the tab group so the app ALWAYS
// opens on the Home tab, no matter which entry URL/deep link state a
// previous session left behind. This is the official expo-router
// mechanism (anchor/initialRouteName) — no synthetic screens.
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function AppShell() {
  const { activeScheme, colors } = useAppTheme();
  return (
    <>
      <StatusBar style={activeScheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          // Smooth, soft screen transitions (native driver, no JS cost).
          // fade_from_bottom slides the new screen up gently while the
          // previous one fades — calmer than the abrupt default.
          animation: "fade_from_bottom",
          animationDuration: 350,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
        <Stack.Screen name="mosques" />
        <Stack.Screen name="qibla" />
        <Stack.Screen name="quran" />
        <Stack.Screen name="listen/index" options={{ animationDuration: 200 }} />
        <Stack.Screen name="listen/reciter" options={{ animationDuration: 280 }} />
        <Stack.Screen name="listen/player" options={{ animationDuration: 280 }} />
        <Stack.Screen name="surah/[number]" options={{ animationDuration: 320 }} />
        <Stack.Screen name="settings" />
      </Stack>
      {/* Boot splash manages its own lifecycle (fade + safety unmount) */}
      <BootSplash />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppDataProvider>
        <AppShell />
      </AppDataProvider>
    </ThemeProvider>
  );
}
