"use client";

import { useState, useCallback, useMemo } from "react";
import { Chess } from "chess.js";

interface ReplayState {
  moves: string[];
  currentIndex: number; // -1 = start position, 0 = after first move, etc.
  displayFen: string;
  isActive: boolean;
  totalMoves: number;
  whitePlayer: string;
  blackPlayer: string;
}

interface ReplayActions {
  startReplay: (moves: string[], whitePlayer?: string, blackPlayer?: string) => void;
  stopReplay: () => void;
  goToMove: (index: number) => void;
  stepForward: () => void;
  stepBack: () => void;
  goToStart: () => void;
  goToEnd: () => void;
}

export function useReplayMode(): ReplayState & ReplayActions {
  const [moves, setMoves] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isActive, setIsActive] = useState(false);
  const [whitePlayer, setWhitePlayer] = useState("White");
  const [blackPlayer, setBlackPlayer] = useState("Black");

  // Compute FEN at the current index
  const displayFen = useMemo(() => {
    const game = new Chess();
    const end = Math.min(currentIndex + 1, moves.length);
    for (let i = 0; i < end; i++) {
      try {
        game.move(moves[i]);
      } catch {
        break;
      }
    }
    return game.fen();
  }, [moves, currentIndex]);

  const startReplay = useCallback((replayMoves: string[], white?: string, black?: string) => {
    setMoves(replayMoves);
    setCurrentIndex(-1);
    setIsActive(true);
    setWhitePlayer(white || "White");
    setBlackPlayer(black || "Black");
  }, []);

  const stopReplay = useCallback(() => {
    setIsActive(false);
    setMoves([]);
    setCurrentIndex(-1);
  }, []);

  const goToMove = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(-1, Math.min(index, moves.length - 1)));
    },
    [moves.length]
  );

  const stepForward = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, moves.length - 1));
  }, [moves.length]);

  const stepBack = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, -1));
  }, []);

  const goToStart = useCallback(() => {
    setCurrentIndex(-1);
  }, []);

  const goToEnd = useCallback(() => {
    setCurrentIndex(moves.length - 1);
  }, [moves.length]);

  return {
    moves,
    currentIndex,
    displayFen,
    isActive,
    totalMoves: moves.length,
    whitePlayer,
    blackPlayer,
    startReplay,
    stopReplay,
    goToMove,
    stepForward,
    stepBack,
    goToStart,
    goToEnd,
  };
}
