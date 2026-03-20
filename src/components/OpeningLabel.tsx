"use client";

import { useTheme } from "@/contexts/ThemeContext";

interface OpeningLabelProps {
  opening: { eco: string; name: string } | null;
}

export default function OpeningLabel({ opening }: OpeningLabelProps) {
  const { theme } = useTheme();

  if (!opening) return null;

  return (
    <div className={`${theme.panel} rounded-lg px-3 py-2`}>
      <span className={`text-xs font-bold ${theme.textMuted}`}>{opening.eco}</span>
      <span className={`text-sm ml-2 ${theme.textSecondary}`}>{opening.name}</span>
    </div>
  );
}
