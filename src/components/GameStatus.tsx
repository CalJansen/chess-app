"use client";

import { useTheme } from "@/contexts/ThemeContext";

interface GameStatusProps {
  status: string;
  isGameOver: boolean;
  inCheck?: boolean;
}

export default function GameStatus({ status, isGameOver, inCheck }: GameStatusProps) {
  const { theme } = useTheme();

  // Game over is handled by the overlay — don't show status bar
  if (isGameOver) return null;

  // Check: animated toast
  if (inCheck) {
    return (
      <div
        className="text-center text-sm font-semibold px-3 py-2 rounded-lg bg-yellow-900/60 text-yellow-200 border border-yellow-600 animate-[slideIn_0.3s_ease-out]"
      >
        {status}
      </div>
    );
  }

  // Normal state: minimal text
  return (
    <div className={`text-center text-sm px-3 py-1.5 ${theme.textMuted}`}>
      {status}
    </div>
  );
}
