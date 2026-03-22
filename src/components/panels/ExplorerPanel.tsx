"use client";

import { useTheme } from "@/contexts/ThemeContext";

interface ExplorerPanelProps {
  // Will be expanded in Phase 12 with opening tree data
}

export default function ExplorerPanel({}: ExplorerPanelProps) {
  const { theme } = useTheme();

  return (
    <div className="flex flex-col gap-3">
      <div className={`${theme.panel} rounded-lg p-3 border ${theme.panelBorder}`}>
        <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide mb-1`}>
          Opening Explorer
        </h3>
        <p className={`text-sm ${theme.textSecondary}`}>
          Coming soon — browse openings, view statistics, and start games from any position.
        </p>
      </div>
    </div>
  );
}
