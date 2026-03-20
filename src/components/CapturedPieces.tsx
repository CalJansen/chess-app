"use client";

import { CapturedPieces as CapturedPiecesType } from "@/hooks/useChessGame";

interface CapturedPiecesProps {
  captured: CapturedPiecesType;
}

export default function CapturedPieces({ captured }: CapturedPiecesProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
        Captured Pieces
      </h3>
      <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-12">White:</span>
          <span className="text-xl tracking-wider">
            {captured.white.length > 0
              ? captured.white.join(" ")
              : "\u2014"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-12">Black:</span>
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
