"use client";

import { useTheme } from "@/contexts/ThemeContext";

interface OpeningLabelProps {
  opening: { eco: string; name: string } | null;
}

export default function OpeningLabel({ opening }: OpeningLabelProps) {
  const { theme } = useTheme();

  return (
    <div>
      <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-2`}>
        Opening
      </h3>
      <div className={`${theme.panel} rounded-lg px-3 py-2`}>
        {opening ? (
          <>
            <span className={`text-xs font-bold ${theme.textMuted}`}>{opening.eco}</span>
            <span className={`text-sm ml-2 ${theme.textSecondary}`}>{opening.name}</span>
          </>
        ) : (
          <span className={`text-sm italic ${theme.textMuted}`}>No opening detected</span>
        )}
      </div>
    </div>
  );
}
