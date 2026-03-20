"use client";

import { useRef, useEffect } from "react";

interface MoveHistoryProps {
  history: string[];
}

export default function MoveHistory({ history }: MoveHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length]);

  // Group moves into pairs (1. e4 e5, 2. Nf3 Nc6, ...)
  const pairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Move History
      </h3>
      <div className="flex-1 overflow-y-auto bg-gray-800/50 rounded-lg p-3 min-h-[120px] max-h-[300px]">
        {pairs.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No moves yet</p>
        ) : (
          <div className="space-y-1">
            {pairs.map((pair) => (
              <div key={pair.num} className="flex text-sm font-mono">
                <span className="text-gray-500 w-8 shrink-0">{pair.num}.</span>
                <span className="text-gray-200 w-16">{pair.white}</span>
                <span className="text-gray-300">{pair.black ?? ""}</span>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
