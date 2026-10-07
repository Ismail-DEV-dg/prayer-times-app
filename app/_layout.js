import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "../theme/ThemeContext";
import { AppDataProvider } from "../utils/AppDataContext";
import BootSplash from "../components/BootSplash";

// Top-level Error Boundary prevents release APK from crashing to desktop
// if any unexpected rendering or native hydration exception occurs.
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.log("[GlobalErrorBoundary] App-level error caught safely:", error?.message);
  }

  resetError = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#050c17", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={54} color="#e5a93c" />
          <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "700", marginTop: 16, textAlign: "center" }}>
            Произошла ошибка при загрузке
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
            Приложение перехвачено защитным экраном, чтобы избежать внезапного закрытия.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 24, backgroundColor: "#e5a93c", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            onPress={this.resetError}
            activeOpacity={0.8}
          >
            <Text style={{ color: "#000000", fontWeight: "700", fontSize: 15 }}>Перезапустить</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

// Pin the root stack's initial route to the tab group so the app ALWAYS
// opens on the Home tab, no matter which entry URL/deep link state a
// previous session left behind. This is the official expo-router
// mechanism (anchor/initialRouteName) — no synthetic screens.
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function AppShell() {
  const { activeScheme, colors } = useTheme();
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
        <Stack.Screen name="read" options={{ animationDuration: 280 }} />
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
    <GlobalErrorBoundary>
      <ThemeProvider>
        <AppDataProvider>
          <AppShell />
        </AppDataProvider>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
