"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface TimeControl {
  name: string;
  minutes: number;
  increment: number; // seconds added per move
}

export const TIME_CONTROLS: TimeControl[] = [
  { name: "No Timer", minutes: 0, increment: 0 },
  { name: "Bullet 1+0", minutes: 1, increment: 0 },
  { name: "Bullet 2+1", minutes: 2, increment: 1 },
  { name: "Blitz 3+0", minutes: 3, increment: 0 },
  { name: "Blitz 3+2", minutes: 3, increment: 2 },
  { name: "Blitz 5+0", minutes: 5, increment: 0 },
  { name: "Rapid 10+0", minutes: 10, increment: 0 },
  { name: "Rapid 15+10", minutes: 15, increment: 10 },
  { name: "Classical 30+0", minutes: 30, increment: 0 },
];

interface ClockState {
  whiteTime: number; // milliseconds remaining
  blackTime: number;
  activeColor: "white" | "black" | null; // null = not started or paused
  isRunning: boolean;
  timeControl: TimeControl;
  whiteTimedOut: boolean;
  blackTimedOut: boolean;
}

export function useChessClock() {
  const [timeControl, setTimeControlState] = useState<TimeControl>(TIME_CONTROLS[0]);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [activeColor, setActiveColor] = useState<"white" | "black" | null>(null);
  const [whiteTimedOut, setWhiteTimedOut] = useState(false);
  const [blackTimedOut, setBlackTimedOut] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isEnabled = timeControl.minutes > 0;
  const isRunning = activeColor !== null && isEnabled;

  // Tick the active clock
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      if (activeColor === "white") {
        setWhiteTime((prev) => {
          if (prev <= 100) {
            setWhiteTimedOut(true);
            setActiveColor(null);
            return 0;
          }
          return prev - 100;
        });
      } else if (activeColor === "black") {
        setBlackTime((prev) => {
          if (prev <= 100) {
            setBlackTimedOut(true);
            setActiveColor(null);
            return 0;
          }
          return prev - 100;
        });
      }
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeColor, isRunning]);

  const setTimeControl = useCallback((tc: TimeControl) => {
    setTimeControlState(tc);
    const ms = tc.minutes * 60 * 1000;
    setWhiteTime(ms);
    setBlackTime(ms);
    setActiveColor(null);
    setWhiteTimedOut(false);
    setBlackTimedOut(false);
  }, []);

  // Called after each move to switch the clock and add increment
  const switchClock = useCallback(
    (justMoved: "white" | "black") => {
      if (!isEnabled) return;

      // Add increment to the player who just moved
      if (timeControl.increment > 0) {
        const incMs = timeControl.increment * 1000;
        if (justMoved === "white") {
          setWhiteTime((prev) => prev + incMs);
        } else {
          setBlackTime((prev) => prev + incMs);
        }
      }

      // Switch active clock
      setActiveColor(justMoved === "white" ? "black" : "white");
    },
    [isEnabled, timeControl.increment]
  );

  // Start the clock (white moves first)
  const startClock = useCallback(() => {
    if (!isEnabled) return;
    setActiveColor("white");
  }, [isEnabled]);

  const pauseClock = useCallback(() => {
    setActiveColor(null);
  }, []);

  const resetClock = useCallback(() => {
    const ms = timeControl.minutes * 60 * 1000;
    setWhiteTime(ms);
    setBlackTime(ms);
    setActiveColor(null);
    setWhiteTimedOut(false);
    setBlackTimedOut(false);
  }, [timeControl.minutes]);

  const clearTimeouts = useCallback(() => {
    setWhiteTimedOut(false);
    setBlackTimedOut(false);
  }, []);

  return {
    whiteTime,
    blackTime,
    activeColor,
    isRunning,
    isEnabled,
    timeControl,
    whiteTimedOut,
    blackTimedOut,
    setTimeControl,
    switchClock,
    startClock,
    pauseClock,
    resetClock,
    clearTimeouts,
  };
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
