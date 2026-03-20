"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ThemeName, Theme, themes } from "@/themes";

interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = "chess-app-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>("dark");
  const [mounted, setMounted] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved in themes) {
        setThemeNameState(saved as ThemeName);
      }
    } catch {
      // localStorage not available
    }
    setMounted(true);
  }, []);

  const setThemeName = (name: ThemeName) => {
    setThemeNameState(name);
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      // localStorage not available
    }
  };

  const theme = themes[themeName];

  // Prevent flash of wrong theme on SSR
  if (!mounted) {
    return (
      <div className="bg-gray-900 text-gray-100 min-h-screen">
        {children}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName }}>
      <div className={`${theme.bg} ${theme.textPrimary} min-h-screen transition-colors duration-300`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
