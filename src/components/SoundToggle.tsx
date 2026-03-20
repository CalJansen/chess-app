"use client";

import { useTheme } from "@/contexts/ThemeContext";

interface SoundToggleProps {
  muted: boolean;
  onToggle: () => void;
}

export default function SoundToggle({ muted, onToggle }: SoundToggleProps) {
  const { theme } = useTheme();

  return (
    <button
      onClick={onToggle}
      className={`px-3 py-2 ${theme.buttonBg} ${theme.buttonHover} ${theme.buttonText} rounded-lg text-sm font-medium transition-colors`}
      title={muted ? "Unmute sounds" : "Mute sounds"}
    >
      {muted ? "🔇 Sound Off" : "🔊 Sound On"}
    </button>
  );
}
