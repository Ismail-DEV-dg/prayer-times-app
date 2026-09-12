import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../theme/ThemeContext";

// The Home tab is always the initial screen of the tab group.
export const unstable_settings = {
  initialRouteName: "index",
};

// Tab group: INSTANT switches (animation "none" — the default two-state
// mode of the JS bottom-tabs navigator).
//
// DO NOT add per-tab transitionSpec/sceneStyleInterpolator here.
// A real (non-"none") transitionSpec keeps BOTH screens attached during
// the 320 ms transition. On Android the react-native-screens container
// orders screens by fragment-attach order (ScreenContainer.onUpdate),
// and its incremental commits re-attach the STATIC old screen (empty
// sceneStyle — fully opaque) ON TOP of the entering screen for the rest
// of the transition. The user sees the PREVIOUS tab's content over the
// new one and then an abrupt swap — i.e. "the wrong screen" on every tab
// switch. With "none" exactly one screen is ever attached, so screen
// identity can never be confused.
// (Smooth transitions remain on the root/settings stacks — native
// fade_from_bottom — and in the micro-animations of 5b.)
export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: "none",
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName = "home";
          if (route.name === "index") iconName = "home";
          else if (route.name === "location") iconName = "location";
          else if (route.name === "settings") iconName = "settings";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Главная" }} />
      <Tabs.Screen name="location" options={{ title: "Местоположение" }} />
      <Tabs.Screen name="settings" options={{ title: "Настройки" }} />
    </Tabs>
  );
}
