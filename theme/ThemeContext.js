import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import { THEMES, THEMES_META } from "./colors";
import { getSavedTheme, saveTheme, getSavedShowMosqueBg, saveShowMosqueBg } from "../utils/storage";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [systemScheme, setSystemScheme] = useState(() => Appearance.getColorScheme() || "light");
  const [themeMode, setThemeModeState] = useState("system"); // 8 choices: dark, light, nature, blue, beige, purple, minimalism, system
  const [showMosqueBg, setShowMosqueBgState] = useState(true);

  // 1. Load saved theme & mosque bg visibility with robust fallback
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [saved, savedMosque] = await Promise.all([
          getSavedTheme(),
          getSavedShowMosqueBg(),
        ]);
        if (mounted) {
          if (saved && (THEMES[saved] || saved === "system")) {
            setThemeModeState(saved);
          }
          if (savedMosque !== null && savedMosque !== undefined) {
            setShowMosqueBgState(Boolean(savedMosque));
          }
        }
      } catch (e) {
        // Fallback default is 'system'
        if (mounted) setThemeModeState("system");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Real-time live update for system theme changes (no app restart required)
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || "light");
    });
    return () => subscription.remove();
  }, []);

  const setThemeMode = async (mode) => {
    setThemeModeState(mode);
    try {
      await saveTheme(mode);
    } catch (e) {
      // Storage error non-blocking
    }
  };

  const setShowMosqueBg = async (show) => {
    const val = Boolean(show);
    setShowMosqueBgState(val);
    try {
      await saveShowMosqueBg(val);
    } catch (e) {
      // Storage error non-blocking
    }
  };

  // Determine active color scheme and tokens
  const activeScheme = useMemo(() => {
    if (themeMode === "system") {
      return systemScheme === "dark" ? "dark" : "light";
    }
    return THEMES[themeMode] ? themeMode : "dark";
  }, [themeMode, systemScheme]);

  const colors = useMemo(() => {
    return THEMES[activeScheme] || THEMES.dark;
  }, [activeScheme]);

  const isDark = colors.isDark;

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      showMosqueBg,
      setShowMosqueBg,
      colors,
      activeScheme,
      isDark,
      themesMeta: THEMES_META,
    }),
    [themeMode, showMosqueBg, colors, activeScheme, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
  return ctx;
}

export const useTheme = useAppTheme;
