"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MoveType = "move" | "capture" | "check" | "castle" | "game-end";

const STORAGE_KEY = "chess-app-sound-muted";

// Frequency-based sound synthesis (no audio files needed)
function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume: number = 0.3) {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = volume;
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);

    // Cleanup
    oscillator.onended = () => ctx.close();
  } catch {
    // Audio not supported
  }
}

const SOUNDS: Record<MoveType, () => void> = {
  move: () => playTone(600, 0.08, "sine", 0.2),
  capture: () => {
    playTone(300, 0.12, "square", 0.15);
    setTimeout(() => playTone(200, 0.08, "square", 0.1), 50);
  },
  check: () => {
    playTone(800, 0.1, "sine", 0.25);
    setTimeout(() => playTone(1000, 0.15, "sine", 0.2), 100);
  },
  castle: () => {
    playTone(500, 0.06, "sine", 0.2);
    setTimeout(() => playTone(600, 0.08, "sine", 0.2), 80);
  },
  "game-end": () => {
    playTone(523, 0.15, "sine", 0.25);
    setTimeout(() => playTone(659, 0.15, "sine", 0.25), 150);
    setTimeout(() => playTone(784, 0.3, "sine", 0.2), 300);
  },
};

export function useSoundEffects() {
  const [muted, setMuted] = useState(true); // default muted until loaded
  const initialized = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setMuted(saved === "true");
    } catch {
      setMuted(false);
    }
    initialized.current = true;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const playSound = useCallback(
    (type: MoveType) => {
      if (muted || !initialized.current) return;
      SOUNDS[type]?.();
    },
    [muted]
  );

  return { muted, toggleMute, playSound };
}
