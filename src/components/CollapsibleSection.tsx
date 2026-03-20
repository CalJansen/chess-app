"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface CollapsibleSectionProps {
  title: string;
  storageKey: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  storageKey,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  // Persist open/closed state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      setOpen(saved === "true");
    }
  }, [storageKey]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(storageKey, String(next));
  };

  return (
    <div>
      <button
        onClick={toggle}
        className={`w-full flex items-center justify-between py-1.5 text-xs font-semibold uppercase tracking-wide ${theme.textMuted} hover:${theme.textSecondary} transition-colors`}
      >
        <span>{title}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="space-y-3 pt-1 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}
