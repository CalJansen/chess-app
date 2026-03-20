"use client";

import { Chessboard } from "react-chessboard";

interface BoardProps {
  fen: string;
  boardOrientation: "white" | "black";
  squareStyles: Record<string, React.CSSProperties>;
  onSquareClick: (square: string, piece: string | null) => void;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  onPieceDragBegin: (square: string) => void;
}

export default function Board({
  fen,
  boardOrientation,
  squareStyles,
  onSquareClick,
  onPieceDrop,
  onPieceDragBegin,
}: BoardProps) {
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
          animationDurationInMs: 200,
          darkSquareStyle: { backgroundColor: "#779952" },
          lightSquareStyle: { backgroundColor: "#edeed1" },
        }}
      />
    </div>
  );
}
