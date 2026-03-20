"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { themeNames, themes } from "@/themes";

export default function ThemeSelector() {
  const { themeName, setThemeName } = useTheme();

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium opacity-60">Theme:</span>
      <div className="flex gap-2">
        {themeNames.map((name) => (
          <button
            key={name}
            onClick={() => setThemeName(name)}
            title={themes[name].label}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              themeName === name
                ? "border-white scale-110 shadow-lg"
                : "border-gray-400/50 opacity-70 hover:opacity-100"
            }`}
            style={{ backgroundColor: themes[name].swatch }}
          />
        ))}
      </div>
    </div>
  );
}
