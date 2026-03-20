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

  // Check: animated toast styling for the content
  const contentClass = inCheck
    ? "text-center text-sm font-semibold px-3 py-2 rounded-lg bg-yellow-900/60 text-yellow-200 border border-yellow-600 animate-[slideIn_0.3s_ease-out]"
    : `text-center text-sm px-3 py-2 rounded-lg ${theme.panel} ${theme.textSecondary}`;

  return (
    <div>
      <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-2`}>
        Game Status
      </h3>
      <div className={contentClass}>
        {status}
      </div>
    </div>
  );
}
