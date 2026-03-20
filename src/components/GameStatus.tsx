"use client";

interface GameStatusProps {
  status: string;
  isGameOver: boolean;
}

export default function GameStatus({ status, isGameOver }: GameStatusProps) {
  return (
    <div
      className={`text-center text-lg font-semibold px-4 py-3 rounded-lg ${
        isGameOver
          ? "bg-red-900/50 text-red-200 border border-red-700"
          : status.includes("check")
          ? "bg-yellow-900/50 text-yellow-200 border border-yellow-700"
          : "bg-gray-800 text-gray-200 border border-gray-700"
      }`}
    >
      {status}
    </div>
  );
}
