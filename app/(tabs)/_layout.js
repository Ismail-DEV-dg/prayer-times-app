import React from "react";
import { Tabs } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { useTheme } from "../../theme/ThemeContext";
import { colors as themeColors, fonts } from "../../theme/theme";

// The Home tab is always the initial screen of the tab group.
export const unstable_settings = {
  initialRouteName: "index",
};

function TabIcon({ routeName, color }) {
  if (routeName === "index") {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      </Svg>
    );
  }
  if (routeName === "quran") {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6zM12 6v13" />
      </Svg>
    );
  }
  if (routeName === "qibla") {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={9} />
        <Path d="M15.5 8.5l-2 5-5 2 2-5z" />
      </Svg>
    );
  }
  if (routeName === "mosques") {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7zM9 4v13M15 7v13" />
      </Svg>
    );
  }
  if (routeName === "settings") {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={5} cy={12} r={1} />
        <Circle cx={12} cy={12} r={1} />
        <Circle cx={19} cy={12} r={1} />
      </Svg>
    );
  }
  return null;
}

export default function TabsLayout() {
  const { colors } = useTheme();

  const activeColor = colors.accent || themeColors.accent;
  const inactiveColor = colors.muted || themeColors.muted;
  const navBg = colors.navBg || themeColors.navBg;
  const borderSoft = colors.borderSoft || themeColors.borderSoft;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: "none",
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: navBg,
          borderTopColor: borderSoft,
          borderTopWidth: 1,
          height: 76,
          paddingBottom: 10,
          paddingTop: 8,
          boxSizing: "border-box",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: fonts.ui.semibold,
        },
        tabBarIcon: ({ color }) => <TabIcon routeName={route.name} color={color} />,
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Главная",
          tabBarLabelStyle: ({ focused }) => ({
            fontSize: 11,
            fontFamily: focused ? fonts.ui.bold : fonts.ui.semibold,
          }),
        }}
      />
      <Tabs.Screen
        name="quran"
        options={{
          title: "Коран",
          tabBarLabelStyle: ({ focused }) => ({
            fontSize: 11,
            fontFamily: focused ? fonts.ui.bold : fonts.ui.semibold,
          }),
        }}
      />
      <Tabs.Screen
        name="qibla"
        options={{
          title: "Кибла",
          tabBarLabelStyle: ({ focused }) => ({
            fontSize: 11,
            fontFamily: focused ? fonts.ui.bold : fonts.ui.semibold,
          }),
        }}
      />
      <Tabs.Screen
        name="mosques"
        options={{
          title: "Карта",
          tabBarLabelStyle: ({ focused }) => ({
            fontSize: 11,
            fontFamily: focused ? fonts.ui.bold : fonts.ui.semibold,
          }),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ещё",
          tabBarLabelStyle: ({ focused }) => ({
            fontSize: 11,
            fontFamily: focused ? fonts.ui.bold : fonts.ui.semibold,
          }),
        }}
      />
      {/* Hidden helper tab for location selector to stay within the shell */}
      <Tabs.Screen name="location" options={{ href: null }} />
    </Tabs>
  );
}

