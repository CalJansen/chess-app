"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Chess, Move } from "chess.js";
import { getTreeRoot, getNodeForMoves, getChildrenForMoves, searchOpenings } from "@/utils/openingsTree";
import { fetchExplorerStats, ExplorerData, ExplorerMove } from "@/services/lichessExplorer";
import type { OpeningTreeNode, SearchResult } from "@/utils/openingsTree";
import type { CapturedPieces } from "@/hooks/useChessGame";

const PIECE_UNICODE: Record<string, string> = {
  bp: "\u265F", bn: "\u265E", bb: "\u265D", br: "\u265C", bq: "\u265B", bk: "\u265A",
};
const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export interface ExplorerState {
  // Current position
  currentMoves: string[];
  currentFen: string;
  currentOpening: { eco: string; name: string } | null;

  // Tree data
  treeChildren: OpeningTreeNode[];

  // Lichess stats
  lichessStats: ExplorerData | null;
  lichessLoading: boolean;

  // Search
  searchQuery: string;
  searchResults: SearchResult[];

  // Actions
  playMove: (san: string) => boolean;
  goToMove: (index: number) => void;
  goToStart: () => void;
  navigateToOpening: (moves: string[]) => void;
  setSearchQuery: (query: string) => void;
  getStartingMoves: () => string[];

  // Captured pieces
  getCapturedPieces: () => CapturedPieces;

  // Board interaction
  onSquareClick: (square: string) => void;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  onPieceDragBegin: (square: string) => void;
  squareStyles: Record<string, React.CSSProperties>;
}

export function useOpeningExplorer(): ExplorerState {
  const [currentMoves, setCurrentMoves] = useState<string[]>([]);
  const [currentFen, setCurrentFen] = useState(getTreeRoot().fen);
  const [currentOpening, setCurrentOpening] = useState<{ eco: string; name: string } | null>(null);
  const [treeChildren, setTreeChildren] = useState<OpeningTreeNode[]>(getTreeRoot().children);
  const [lichessStats, setLichessStats] = useState<ExplorerData | null>(null);
  const [lichessLoading, setLichessLoading] = useState(false);
  const [searchQuery, setSearchQueryState] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);

  const gameRef = useRef<Chess>(new Chess());
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Update tree children and opening info when moves change
  const updatePosition = useCallback((moves: string[]) => {
    const game = new Chess();
    for (const san of moves) {
      try {
        game.move(san);
      } catch {
        break;
      }
    }
    gameRef.current = game;

    const fen = game.fen();
    setCurrentFen(fen);

    // Get tree node info
    const node = getNodeForMoves(moves);
    // Only update opening when a match is found — preserve last known opening
    if (node?.eco && node?.name) {
      setCurrentOpening({ eco: node.eco, name: node.name });
    }
    setTreeChildren(getChildrenForMoves(moves));
    setSelectedSquare(null);
    setLegalMoves([]);

    // Debounce Lichess fetch (300ms)
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    setLichessLoading(true);
    fetchTimeoutRef.current = setTimeout(async () => {
      const stats = await fetchExplorerStats(fen);
      setLichessStats(stats);
      setLichessLoading(false);
    }, 300);
  }, []);

  // Fetch initial stats for starting position
  useEffect(() => {
    updatePosition([]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playMove = useCallback((san: string): boolean => {
    const game = gameRef.current;
    try {
      game.move(san);
      const newMoves = game.history();
      setCurrentMoves(newMoves);
      updatePosition(newMoves);
      return true;
    } catch {
      return false;
    }
  }, [updatePosition]);

  const goToMove = useCallback((index: number) => {
    const moves = currentMoves.slice(0, index + 1);
    setCurrentMoves(moves);
    updatePosition(moves);
  }, [currentMoves, updatePosition]);

  const goToStart = useCallback(() => {
    setCurrentMoves([]);
    setCurrentOpening(null);
    updatePosition([]);
  }, [updatePosition]);

  const navigateToOpening = useCallback((moves: string[]) => {
    setCurrentMoves(moves);
    updatePosition(moves);
    setSearchQueryState("");
    setSearchResults([]);
  }, [updatePosition]);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    if (query.trim()) {
      setSearchResults(searchOpenings(query, 15));
    } else {
      setSearchResults([]);
    }
  }, []);

  const getStartingMoves = useCallback(() => {
    return [...currentMoves];
  }, [currentMoves]);

  // Board interaction for explorer mode
  const onSquareClick = useCallback((square: string) => {
    const game = gameRef.current;
    if (game.isGameOver()) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }
      if (legalMoves.includes(square)) {
        // Try the move
        try {
          const result = game.move({ from: selectedSquare, to: square, promotion: "q" });
          if (result) {
            const newMoves = game.history();
            setCurrentMoves(newMoves);
            setSelectedSquare(null);
            setLegalMoves([]);
            updatePosition(newMoves);
            return;
          }
        } catch { /* invalid */ }
      }
    }

    // Select a piece
    const piece = game.get(square as import("chess.js").Square);
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      const moves = game.moves({ square: square as import("chess.js").Square, verbose: true });
      setLegalMoves(moves.map(m => m.to));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [selectedSquare, legalMoves, updatePosition]);

  const onPieceDrop = useCallback((sourceSquare: string, targetSquare: string): boolean => {
    const game = gameRef.current;
    try {
      game.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      const newMoves = game.history();
      setCurrentMoves(newMoves);
      setSelectedSquare(null);
      setLegalMoves([]);
      updatePosition(newMoves);
      return true;
    } catch {
      return false;
    }
  }, [updatePosition]);

  const onPieceDragBegin = useCallback((square: string) => {
    const game = gameRef.current;
    setSelectedSquare(square);
    const moves = game.moves({ square: square as import("chess.js").Square, verbose: true });
    setLegalMoves(moves.map(m => m.to));
  }, []);

  // Build square styles
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (selectedSquare) {
    squareStyles[selectedSquare] = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
  }
  for (const sq of legalMoves) {
    const piece = gameRef.current.get(sq as import("chess.js").Square);
    if (piece) {
      squareStyles[sq] = {
        background: "radial-gradient(circle, transparent 55%, rgba(0, 0, 0, 0.3) 55%)",
      };
    } else {
      squareStyles[sq] = {
        background: "radial-gradient(circle, rgba(0, 0, 0, 0.25) 25%, transparent 25%)",
      };
    }
  }

  const getCapturedPieces = useCallback((): CapturedPieces => {
    const captured: CapturedPieces = { white: [], black: [], materialAdvantage: { white: 0, black: 0 } };
    const history = gameRef.current.history({ verbose: true }) as Move[];
    let whiteValue = 0;
    let blackValue = 0;
    for (const move of history) {
      if (move.captured) {
        const key = `b${move.captured}`;
        const symbol = PIECE_UNICODE[key] || move.captured;
        const value = PIECE_VALUES[move.captured] || 0;
        if (move.color === "w") {
          captured.white.push(symbol);
          whiteValue += value;
        } else {
          captured.black.push(symbol);
          blackValue += value;
        }
      }
    }
    const diff = whiteValue - blackValue;
    captured.materialAdvantage = { white: diff > 0 ? diff : 0, black: diff < 0 ? -diff : 0 };
    return captured;
  }, [currentFen]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    currentMoves,
    currentFen,
    currentOpening,
    treeChildren,
    lichessStats,
    lichessLoading,
    searchQuery,
    searchResults,
    playMove,
    goToMove,
    goToStart,
    navigateToOpening,
    setSearchQuery,
    getStartingMoves,
    getCapturedPieces,
    onSquareClick,
    onPieceDrop,
    onPieceDragBegin,
    squareStyles,
  };
}
