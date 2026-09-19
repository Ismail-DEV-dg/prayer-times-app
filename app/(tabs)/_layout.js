import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";

// The Home tab is always the initial screen of the tab group.
export const unstable_settings = {
  initialRouteName: "index",
};

// Unified Bottom Tab Navigator matching Stitch mockup:
// 5 tabs: (Главная, Коран, Кибла, Карта, Ещё).
export default function TabsLayout() {
  const { colors } = useTheme();

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
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: "600",
        },
        tabBarIcon: ({ color, focused, size }) => {
          let iconName = "home";
          if (route.name === "index") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "quran") {
            iconName = focused ? "book" : "book-outline";
          } else if (route.name === "qibla") {
            iconName = focused ? "compass" : "compass-outline";
          } else if (route.name === "mosques") {
            iconName = focused ? "map" : "map-outline";
          } else if (route.name === "settings") {
            iconName = focused ? "ellipsis-horizontal" : "ellipsis-horizontal-outline";
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Главная" }} />
      <Tabs.Screen name="quran" options={{ title: "Коран" }} />
      <Tabs.Screen name="qibla" options={{ title: "Кибла" }} />
      <Tabs.Screen name="mosques" options={{ title: "Карта" }} />
      <Tabs.Screen name="settings" options={{ title: "Ещё" }} />
      {/* Hidden helper tab for location selector to stay within the shell */}
      <Tabs.Screen name="location" options={{ href: null }} />
    </Tabs>
  );
}
