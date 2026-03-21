"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { fetchRandomPuzzle, PuzzleData } from "@/services/api";

export type PuzzleStatus = "loading" | "playing" | "correct" | "wrong" | "solved" | "no-puzzles";

interface PuzzleStats {
  solved: number;
  attempted: number;
  streak: number;
}

interface PuzzleState {
  puzzle: PuzzleData | null;
  status: PuzzleStatus;
  fen: string;
  solutionIndex: number; // Which solution move we're on (0-based, skipping setup move)
  totalSolutionMoves: number; // How many moves the user needs to find
  stats: PuzzleStats;
  lastMoveCorrect: boolean | null;
  showingSolution: boolean;
  solutionMoves: string[]; // SAN versions of solution for display

  loadPuzzle: (ratingMin?: number, ratingMax?: number, theme?: string) => void;
  tryMove: (from: string, to: string, promotion?: string) => boolean;
  showSolution: () => void;
  retry: () => void;
}

function loadStats(): PuzzleStats {
  if (typeof window === "undefined") return { solved: 0, attempted: 0, streak: 0 };
  try {
    const raw = localStorage.getItem("chess-puzzle-stats");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { solved: 0, attempted: 0, streak: 0 };
}

function saveStats(stats: PuzzleStats) {
  if (typeof window !== "undefined") {
    localStorage.setItem("chess-puzzle-stats", JSON.stringify(stats));
  }
}

export function usePuzzle(): PuzzleState {
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [status, setStatus] = useState<PuzzleStatus>("loading");
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [lastMoveCorrect, setLastMoveCorrect] = useState<boolean | null>(null);
  const [showingSolution, setShowingSolution] = useState(false);
  const [solutionMoves, setSolutionMoves] = useState<string[]>([]);
  const [stats, setStats] = useState<PuzzleStats>(loadStats);

  // Game instance ref for move validation
  const gameRef = useRef<Chess>(new Chess());
  // Store current puzzle data for move checking
  const puzzleRef = useRef<PuzzleData | null>(null);

  // Count of user moves needed (every other move in solution after setup)
  const totalSolutionMoves = puzzle
    ? Math.ceil((puzzle.moves.length - 1) / 2)
    : 0;

  const loadPuzzle = useCallback(async (
    ratingMin: number = 0,
    ratingMax: number = 9999,
    theme?: string,
  ) => {
    setStatus("loading");
    setLastMoveCorrect(null);
    setShowingSolution(false);
    setSolutionMoves([]);

    const data = await fetchRandomPuzzle(ratingMin, ratingMax, theme);
    if (!data) {
      setStatus("no-puzzles");
      return;
    }

    // Set up the position: FEN is the position BEFORE the setup move
    const game = new Chess(data.fen);

    // Play the setup move (first move in the solution — this is the opponent's move)
    const setupMove = data.moves[0];
    game.move({
      from: setupMove.slice(0, 2),
      to: setupMove.slice(2, 4),
      promotion: setupMove.length > 4 ? setupMove[4] : undefined,
    });

    // Compute SAN for all solution moves (for display)
    const tempGame = new Chess(game.fen());
    const sans: string[] = [];
    for (let i = 1; i < data.moves.length; i++) {
      const m = data.moves[i];
      try {
        const result = tempGame.move({
          from: m.slice(0, 2),
          to: m.slice(2, 4),
          promotion: m.length > 4 ? m[4] : undefined,
        });
        if (result) sans.push(result.san);
      } catch {
        break;
      }
    }

    setPuzzle(data);
    puzzleRef.current = data;
    gameRef.current = game;
    setFen(game.fen());
    setSolutionIndex(0);
    setSolutionMoves(sans);
    setStatus("playing");
  }, []);

  // Try a user move — returns true if the move was made (correct or not)
  const tryMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (status !== "playing" && status !== "wrong") return false;

    const data = puzzleRef.current;
    if (!data) return false;

    const game = gameRef.current;

    // The expected move index in the solution array
    // Solution moves: [setup, userMove1, opponentReply1, userMove2, opponentReply2, ...]
    // solutionIndex 0 → data.moves[1], solutionIndex 1 → data.moves[3], etc.
    const expectedMoveIndex = 1 + solutionIndex * 2;
    const expectedUCI = data.moves[expectedMoveIndex];

    if (!expectedUCI) return false;

    // Build the user's UCI move
    const userUCI = from + to + (promotion || "");

    // Check if the move matches
    if (userUCI === expectedUCI) {
      // Correct! Play the move
      try {
        game.move({ from, to, promotion });
      } catch {
        return false;
      }

      setFen(game.fen());
      setLastMoveCorrect(true);

      // Check if there's an opponent reply to play
      const replyIndex = expectedMoveIndex + 1;
      if (replyIndex < data.moves.length) {
        // Play opponent's reply after a short delay
        const reply = data.moves[replyIndex];
        setTimeout(() => {
          try {
            game.move({
              from: reply.slice(0, 2),
              to: reply.slice(2, 4),
              promotion: reply.length > 4 ? reply[4] : undefined,
            });
            setFen(game.fen());
          } catch { /* ignore */ }
        }, 400);
      }

      const nextIndex = solutionIndex + 1;
      setSolutionIndex(nextIndex);

      // Check if puzzle is fully solved
      if (nextIndex >= totalSolutionMoves) {
        setStatus("solved");
        setStats(prev => {
          const updated = {
            solved: prev.solved + 1,
            attempted: prev.attempted + (status === "wrong" ? 0 : 1),
            streak: prev.streak + 1,
          };
          saveStats(updated);
          return updated;
        });
      } else {
        setStatus("playing");
      }

      return true;
    } else {
      // Wrong move — try to make it anyway to show it's legal
      try {
        const result = game.move({ from, to, promotion });
        if (result) {
          // It was a legal move, just wrong — undo it
          game.undo();
        }
      } catch { /* not even legal */ }

      setLastMoveCorrect(false);

      if (status !== "wrong") {
        // First wrong attempt — mark as attempted
        setStats(prev => {
          const updated = {
            ...prev,
            attempted: prev.attempted + 1,
            streak: 0,
          };
          saveStats(updated);
          return updated;
        });
      }
      setStatus("wrong");
      return false;
    }
  }, [status, solutionIndex, totalSolutionMoves]);

  const showSolution = useCallback(() => {
    setShowingSolution(true);
    if (status === "playing") {
      // Count as attempted but not solved
      setStats(prev => {
        const updated = { ...prev, attempted: prev.attempted + 1, streak: 0 };
        saveStats(updated);
        return updated;
      });
    }
    setStatus("wrong");
  }, [status]);

  const retry = useCallback(() => {
    const data = puzzleRef.current;
    if (!data) return;

    // Reset to position after setup move
    const game = new Chess(data.fen);
    const setupMove = data.moves[0];
    game.move({
      from: setupMove.slice(0, 2),
      to: setupMove.slice(2, 4),
      promotion: setupMove.length > 4 ? setupMove[4] : undefined,
    });

    gameRef.current = game;
    setFen(game.fen());
    setSolutionIndex(0);
    setLastMoveCorrect(null);
    setShowingSolution(false);
    setStatus("playing");
  }, []);

  // Load initial stats from localStorage
  useEffect(() => {
    setStats(loadStats());
  }, []);

  return {
    puzzle,
    status,
    fen,
    solutionIndex,
    totalSolutionMoves,
    stats,
    lastMoveCorrect,
    showingSolution,
    solutionMoves,
    loadPuzzle,
    tryMove,
    showSolution,
    retry,
  };
}
