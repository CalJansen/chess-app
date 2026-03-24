"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useAppMode, AppMode } from "@/contexts/AppModeContext";

const tabs: { mode: AppMode; icon: string; label: string }[] = [
  { mode: "play", icon: "\u265F", label: "Play" },
  { mode: "explorer", icon: "\uD83D\uDCD6", label: "Explorer" },
  { mode: "puzzles", icon: "\uD83E\uDDE9", label: "Puzzles" },
  { mode: "history", icon: "\uD83D\uDCCB", label: "History" },
];

export default function TabBar() {
  const { theme } = useTheme();
  const { mode, setMode } = useAppMode();

  return (
    <div className={`flex items-center justify-center gap-1 ${theme.panel} rounded-xl px-2 py-1.5 mb-4`}>
      {tabs.map((tab) => {
        const isActive = mode === tab.mode;
        return (
          <button
            key={tab.mode}
            onClick={() => setMode(tab.mode)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? "bg-blue-600 text-white shadow-md"
                : `${theme.buttonBg} ${theme.buttonHover} ${theme.buttonText} opacity-70 hover:opacity-100`
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
