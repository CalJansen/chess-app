"use client";

import OpeningLabel from "@/components/OpeningLabel";
import MoveHistory from "@/components/MoveHistory";
import GameStatus from "@/components/GameStatus";
import ReviewPanel from "@/components/ReviewPanel";
import type { Opening } from "@/utils/openings";
import type { MoveAnalysis, AccuracyStats } from "@/services/api";

interface PlayPanelProps {
  // Opening
  opening: Opening | null;
  // Move history
  moveHistory: string[];
  // Replay
  isReplaying: boolean;
  replayMoves: string[];
  replayCurrentIndex: number;
  previewIndex?: number | null;
  onMoveClick?: (index: number) => void;
  onStartClick?: () => void;
  // Game status
  status: string;
  isGameOver: boolean;
  inCheck: boolean;
  // Review
  reviewStatus: "idle" | "loading" | "done" | "error";
  reviewAnalysis: MoveAnalysis[] | null;
  reviewAccuracy: AccuracyStats | null;
  reviewError: string | null;
  reviewProgress: string;
  onStartReview: () => void;
}

export default function PlayPanel({
  opening,
  moveHistory,
  isReplaying,
  replayMoves,
  replayCurrentIndex,
  onMoveClick,
  onStartClick,
  previewIndex,
  status,
  isGameOver,
  inCheck,
  reviewStatus,
  reviewAnalysis,
  reviewAccuracy,
  reviewError,
  reviewProgress,
  onStartReview,
}: PlayPanelProps) {
  return (
    <>
      <OpeningLabel opening={opening} />

      <MoveHistory
        history={isReplaying ? replayMoves : moveHistory}
        currentMoveIndex={isReplaying ? replayCurrentIndex : previewIndex !== null && previewIndex !== undefined ? previewIndex : undefined}
        onMoveClick={onMoveClick}
        showStart
        onStartClick={onStartClick}
        reviewAnalysis={reviewStatus === "done" ? reviewAnalysis ?? undefined : undefined}
      />

      {!isReplaying && (
        <GameStatus
          status={status}
          isGameOver={isGameOver}
          inCheck={inCheck}
        />
      )}

      {isReplaying && (
        <ReviewPanel
          status={reviewStatus}
          analysis={reviewAnalysis ?? []}
          accuracy={reviewAccuracy}
          error={reviewError}
          progress={reviewProgress}
          currentMoveIndex={replayCurrentIndex}
          onStartReview={onStartReview}
        />
      )}
    </>
  );
}
