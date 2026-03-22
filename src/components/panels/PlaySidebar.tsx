"use client";

import GameModeSelector from "@/components/GameModeSelector";
import ChessClock from "@/components/ChessClock";
import AnalysisToggle from "@/components/AnalysisToggle";
import SoundToggle from "@/components/SoundToggle";
import ThemeSelector from "@/components/ThemeSelector";
import CollapsibleSection from "@/components/CollapsibleSection";
import PGNModal from "@/components/PGNModal";
import { useState, useCallback } from "react";
import type { EngineModel } from "@/services/api";
import type { TimeControl } from "@/hooks/useChessClock";

interface PlaySidebarProps {
  // Game mode
  aiEnabled: boolean;
  aiThinking: boolean;
  selectedEngine: string;
  playerColor: "white" | "black";
  availableModels: EngineModel[];
  backendOnline: boolean;
  aiError: string | null;
  onToggleAI: () => void;
  onSetEngine: (engine: string) => void;
  onSetColor: (color: "white" | "black") => void;
  // Clock
  whiteTime: number;
  blackTime: number;
  activeColor: "white" | "black" | null;
  clockEnabled: boolean;
  timeControl: TimeControl;
  onSetTimeControl: (tc: TimeControl) => void;
  // Analysis
  analysisEnabled: boolean;
  onToggleAnalysis: () => void;
  onHint: () => void;
  hintLoading: boolean;
  stockfishAvailable: boolean;
  // Sound
  muted: boolean;
  onToggleMute: () => void;
  // PGN
  moveHistory: string[];
  gameResult: string;
  onPGNImport: (moves: string[]) => void;
  // Replay
  isReplaying: boolean;
}

export default function PlaySidebar({
  aiEnabled,
  aiThinking,
  selectedEngine,
  playerColor,
  availableModels,
  backendOnline,
  aiError,
  onToggleAI,
  onSetEngine,
  onSetColor,
  whiteTime,
  blackTime,
  activeColor,
  clockEnabled,
  timeControl,
  onSetTimeControl,
  analysisEnabled,
  onToggleAnalysis,
  onHint,
  hintLoading,
  stockfishAvailable,
  muted,
  onToggleMute,
  moveHistory,
  gameResult,
  onPGNImport,
  isReplaying,
}: PlaySidebarProps) {
  const [showPGN, setShowPGN] = useState(false);

  const handlePGNImport = useCallback((moves: string[]) => {
    onPGNImport(moves);
    setShowPGN(false);
  }, [onPGNImport]);

  if (isReplaying) return null;

  return (
    <>
      <CollapsibleSection title="Game Setup" storageKey="chess-section-setup" defaultOpen={true}>
        <GameModeSelector
          aiEnabled={aiEnabled}
          aiThinking={aiThinking}
          selectedEngine={selectedEngine}
          playerColor={playerColor}
          availableModels={availableModels}
          backendOnline={backendOnline}
          error={aiError}
          onToggleAI={onToggleAI}
          onSetEngine={onSetEngine}
          onSetColor={onSetColor}
        />
        <ChessClock
          whiteTime={whiteTime}
          blackTime={blackTime}
          activeColor={activeColor}
          isEnabled={clockEnabled}
          timeControl={timeControl}
          onSetTimeControl={onSetTimeControl}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Tools" storageKey="chess-section-tools" defaultOpen={true}>
        <AnalysisToggle
          analysisEnabled={analysisEnabled}
          onToggleAnalysis={onToggleAnalysis}
          onHint={onHint}
          hintLoading={hintLoading}
          isAvailable={stockfishAvailable}
        />
        <div className="flex flex-wrap gap-2">
          <SoundToggle muted={muted} onToggle={onToggleMute} />
          <button
            onClick={() => setShowPGN(true)}
            className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            PGN
          </button>
        </div>
        <ThemeSelector />
      </CollapsibleSection>

      {showPGN && (
        <PGNModal
          history={moveHistory}
          result={gameResult}
          onImport={handlePGNImport}
          onClose={() => setShowPGN(false)}
        />
      )}
    </>
  );
}
