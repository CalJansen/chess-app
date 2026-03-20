"use client";

import { CapturedPieces as CapturedPiecesType } from "@/hooks/useChessGame";
import { useTheme } from "@/contexts/ThemeContext";

interface CapturedPiecesProps {
  captured: CapturedPiecesType;
}

export default function CapturedPieces({ captured }: CapturedPiecesProps) {
  const { theme } = useTheme();

  return (
    <div className="space-y-2">
      <h3 className={`text-sm font-semibold ${theme.textMuted} uppercase tracking-wide`}>
        Captured Pieces
      </h3>
      <div className={`${theme.panel} rounded-lg p-3 space-y-2`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${theme.textMuted} w-12`}>White:</span>
          <span className="text-xl tracking-wider">
            {captured.white.length > 0
              ? captured.white.join(" ")
              : "\u2014"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${theme.textMuted} w-12`}>Black:</span>
          <span className="text-xl tracking-wider">
            {captured.black.length > 0
              ? captured.black.join(" ")
              : "\u2014"}
          </span>
        </div>
      </div>
    </div>
  );
}
