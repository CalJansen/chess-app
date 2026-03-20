"use client";

import { useTheme } from "@/contexts/ThemeContext";

interface GameStatusProps {
  status: string;
  isGameOver: boolean;
}

export default function GameStatus({ status, isGameOver }: GameStatusProps) {
  const { theme } = useTheme();

  // Game over and check states keep their semantic colors regardless of theme
  const statusClasses = isGameOver
    ? "bg-red-900/50 text-red-200 border border-red-700"
    : status.includes("check")
    ? "bg-yellow-900/50 text-yellow-200 border border-yellow-700"
    : `${theme.statusDefault} ${theme.statusDefaultText} border ${theme.statusDefaultBorder}`;

  return (
    <div
      className={`text-center text-lg font-semibold px-4 py-3 rounded-lg ${statusClasses}`}
    >
      {status}
    </div>
  );
}
