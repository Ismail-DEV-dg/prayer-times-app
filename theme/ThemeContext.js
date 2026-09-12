import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { lightColors, darkColors } from "./colors";
import { getSavedTheme, saveTheme } from "../utils/storage";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState("system"); // 'light' | 'dark' | 'system'

  useEffect(() => {
    (async () => {
      const saved = await getSavedTheme();
      if (saved) setThemeModeState(saved);
    })();
  }, []);

  const setThemeMode = async (mode) => {
    setThemeModeState(mode);
    await saveTheme(mode);
  };

  const activeScheme = themeMode === "system" ? systemScheme || "light" : themeMode;
  const colors = activeScheme === "dark" ? darkColors : lightColors;

  const value = useMemo(
    () => ({ themeMode, setThemeMode, colors, activeScheme }),
    [themeMode, colors, activeScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
  return ctx;
}
