"use client";

import { useTheme } from "@/contexts/ThemeContext";
import type { ExplorerState } from "@/hooks/useOpeningExplorer";
import type { ExplorerMove } from "@/services/lichessExplorer";
import type { OpeningTreeNode } from "@/utils/openingsTree";

interface ExplorerPanelProps {
  explorer: ExplorerState;
  onStartFromHere: () => void;
}

function WinBar({ white, draws, black }: { white: number; draws: number; black: number }) {
  const total = white + draws + black;
  if (total === 0) return null;
  const wp = (white / total) * 100;
  const dp = (draws / total) * 100;
  const bp = (black / total) * 100;

  return (
    <div className="flex h-3 rounded-sm overflow-hidden text-[9px] font-medium leading-3">
      <div className="bg-white text-gray-900 text-center" style={{ width: `${wp}%` }}>
        {wp >= 15 ? `${Math.round(wp)}%` : ""}
      </div>
      <div className="bg-gray-400 text-gray-900 text-center" style={{ width: `${dp}%` }}>
        {dp >= 15 ? `${Math.round(dp)}%` : ""}
      </div>
      <div className="bg-gray-800 text-white text-center" style={{ width: `${bp}%` }}>
        {bp >= 15 ? `${Math.round(bp)}%` : ""}
      </div>
    </div>
  );
}

function formatGames(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function ExplorerPanel({ explorer, onStartFromHere }: ExplorerPanelProps) {
  const { theme } = useTheme();

  // Merge tree children with Lichess stats for move display
  const movesWithStats: {
    san: string;
    openingName?: string;
    eco?: string;
    lichess?: ExplorerMove;
  }[] = [];

  // Start with Lichess moves if available (they come sorted by popularity)
  if (explorer.lichessStats) {
    for (const lm of explorer.lichessStats.moves) {
      const treeChild = explorer.treeChildren.find(c => c.move === lm.san);
      movesWithStats.push({
        san: lm.san,
        openingName: treeChild?.name,
        eco: treeChild?.eco,
        lichess: lm,
      });
    }
    // Add tree children not in Lichess results
    for (const tc of explorer.treeChildren) {
      if (!movesWithStats.find(m => m.san === tc.move)) {
        movesWithStats.push({
          san: tc.move,
          openingName: tc.name,
          eco: tc.eco,
        });
      }
    }
  } else {
    // No Lichess data yet — show tree children
    for (const tc of explorer.treeChildren) {
      movesWithStats.push({
        san: tc.move,
        openingName: tc.name,
        eco: tc.eco,
      });
    }
  }

  // Overall position stats
  const posStats = explorer.lichessStats;
  const totalGames = posStats ? posStats.white + posStats.draws + posStats.black : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className={`${theme.panel} rounded-lg p-3 border ${theme.panelBorder}`}>
        <input
          type="text"
          value={explorer.searchQuery}
          onChange={(e) => explorer.setSearchQuery(e.target.value)}
          placeholder="Search openings..."
          className={`w-full px-3 py-1.5 rounded text-sm ${theme.panel} ${theme.textPrimary} border border-white/20 focus:border-blue-500 focus:outline-none`}
        />

        {/* Search results dropdown */}
        {explorer.searchResults.length > 0 && (
          <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1">
            {explorer.searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => explorer.navigateToOpening(r.moves)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${theme.textSecondary} hover:bg-white/10 transition-colors`}
              >
                <span className={`${theme.textMuted} mr-1.5`}>{r.eco}</span>
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Breadcrumb trail */}
      <div className={`${theme.panel} rounded-lg p-3 border ${theme.panelBorder}`}>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <button
            onClick={explorer.goToStart}
            className={`px-1.5 py-0.5 rounded ${
              explorer.currentMoves.length === 0
                ? "bg-blue-600 text-white"
                : `${theme.textMuted} hover:bg-white/10`
            } transition-colors`}
          >
            Start
          </button>
          {explorer.currentMoves.map((move, i) => {
            const isWhite = i % 2 === 0;
            const moveNum = Math.floor(i / 2) + 1;
            const isLast = i === explorer.currentMoves.length - 1;
            return (
              <span key={i} className="flex items-center gap-0.5">
                <span className={theme.textMuted}>&rsaquo;</span>
                <button
                  onClick={() => explorer.goToMove(i)}
                  className={`px-1.5 py-0.5 rounded ${
                    isLast
                      ? "bg-blue-600 text-white"
                      : `${theme.textSecondary} hover:bg-white/10`
                  } transition-colors`}
                >
                  {isWhite ? `${moveNum}.` : `${moveNum}...`}{move}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {/* Current opening name */}
      {explorer.currentOpening && (
        <div className={`${theme.panel} rounded-lg p-3 border ${theme.panelBorder}`}>
          <span className={`text-xs ${theme.textMuted} mr-2`}>{explorer.currentOpening.eco}</span>
          <span className={`text-sm font-semibold ${theme.textPrimary}`}>{explorer.currentOpening.name}</span>
        </div>
      )}

      {/* Position stats from Lichess */}
      {totalGames > 0 && (
        <div className={`${theme.panel} rounded-lg p-3 border ${theme.panelBorder}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs ${theme.textMuted} uppercase tracking-wide`}>Position Stats</span>
            <span className={`text-xs ${theme.textMuted}`}>{formatGames(totalGames)} games</span>
          </div>
          <WinBar white={posStats!.white} draws={posStats!.draws} black={posStats!.black} />
        </div>
      )}

      {/* Move list */}
      <div className={`${theme.panel} rounded-lg border ${theme.panelBorder}`}>
        <div className={`px-3 py-2 border-b border-white/10 flex items-center justify-between`}>
          <span className={`text-xs ${theme.textMuted} uppercase tracking-wide`}>
            Moves
          </span>
          {explorer.lichessLoading && (
            <span className={`text-xs ${theme.textMuted} animate-pulse`}>Loading stats...</span>
          )}
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {movesWithStats.length === 0 ? (
            <p className={`px-3 py-4 text-sm ${theme.textMuted} italic text-center`}>
              {explorer.currentMoves.length === 0 ? "Loading..." : "No known continuations"}
            </p>
          ) : (
            movesWithStats.map((m, i) => {
              const totalMoveGames = m.lichess
                ? m.lichess.white + m.lichess.draws + m.lichess.black
                : 0;

              return (
                <button
                  key={i}
                  onClick={() => explorer.playMove(m.san)}
                  className={`w-full flex flex-col gap-1 px-3 py-2 text-left hover:bg-white/5 transition-colors ${
                    i < movesWithStats.length - 1 ? "border-b border-white/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${theme.textPrimary}`}>{m.san}</span>
                      {m.openingName && (
                        <span className={`text-xs ${theme.textSecondary} truncate max-w-[140px]`}>
                          {m.eco && <span className={`${theme.textMuted} mr-1`}>{m.eco}</span>}
                          {m.openingName}
                        </span>
                      )}
                    </div>
                    {totalMoveGames > 0 && (
                      <span className={`text-xs ${theme.textMuted} flex-shrink-0`}>
                        {formatGames(totalMoveGames)}
                      </span>
                    )}
                  </div>
                  {m.lichess && totalMoveGames > 0 && (
                    <WinBar white={m.lichess.white} draws={m.lichess.draws} black={m.lichess.black} />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Start game from here */}
      {explorer.currentMoves.length > 0 && (
        <button
          onClick={onStartFromHere}
          className="w-full py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          Start Game from Here
        </button>
      )}
    </div>
  );
}
