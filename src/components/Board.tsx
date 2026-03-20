"use client";

import { Chessboard } from "react-chessboard";
import { useTheme } from "@/contexts/ThemeContext";

interface BoardArrow {
  startSquare: string;
  endSquare: string;
  color: string;
}

interface BoardProps {
  fen: string;
  boardOrientation: "white" | "black";
  squareStyles: Record<string, React.CSSProperties>;
  arrows?: BoardArrow[];
  onSquareClick: (square: string, piece: string | null) => void;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  onPieceDragBegin: (square: string) => void;
}

export default function Board({
  fen,
  boardOrientation,
  squareStyles,
  arrows = [],
  onSquareClick,
  onPieceDrop,
  onPieceDragBegin,
}: BoardProps) {
  const { theme } = useTheme();

  return (
    <div className="w-full max-w-[560px] aspect-square">
      <Chessboard
        options={{
          position: fen,
          boardOrientation,
          squareStyles,
          onSquareClick: ({ square, piece }) => {
            onSquareClick(square, piece?.pieceType ?? null);
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare) return false;
            return onPieceDrop(sourceSquare, targetSquare);
          },
          onPieceDrag: ({ square }) => {
            if (square) onPieceDragBegin(square);
          },
          arrows: arrows.length > 0 ? arrows : undefined,
          animationDurationInMs: 200,
          darkSquareStyle: { backgroundColor: theme.darkSquare },
          lightSquareStyle: { backgroundColor: theme.lightSquare },
        }}
      />
    </div>
  );
}
