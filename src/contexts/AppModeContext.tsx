"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type AppMode = "play" | "explorer" | "puzzles" | "history";

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const AppModeContext = createContext<AppModeContextType>({
  mode: "play",
  setMode: () => {},
});

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("play");

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
  }, []);

  return (
    <AppModeContext.Provider value={{ mode, setMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(AppModeContext);
}
