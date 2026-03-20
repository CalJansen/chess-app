"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface PlayerNameBarProps {
  name: string;
  color: "white" | "black";
  isActive: boolean;
  capturedPieces: string[];
  isEditable?: boolean;
  onNameChange?: (name: string) => void;
}

export default function PlayerNameBar({
  name,
  color,
  isActive,
  capturedPieces,
  isEditable = false,
  onNameChange,
}: PlayerNameBarProps) {
  const { theme } = useTheme();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) {
      onNameChange?.(trimmed);
    } else {
      setEditValue(name);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") {
      setEditValue(name);
      setEditing(false);
    }
  };

  const dotColor = color === "white" ? "bg-white" : "bg-gray-800";
  const dotBorder = color === "white" ? "border-gray-400" : "border-gray-500";

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-all ${
        isActive
          ? `${theme.panel} border-l-2 border-l-green-500`
          : "border-l-2 border-l-transparent"
      }`}
    >
      {/* Color indicator */}
      <span
        className={`w-3 h-3 rounded-full ${dotColor} border ${dotBorder} flex-shrink-0`}
      />

      {/* Name */}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          maxLength={20}
          className={`text-sm font-medium bg-transparent border-b ${theme.textPrimary} outline-none w-24`}
        />
      ) : (
        <span
          onClick={() => {
            if (isEditable) {
              setEditValue(name);
              setEditing(true);
            }
          }}
          className={`text-sm font-medium ${
            isActive ? theme.textPrimary : theme.textSecondary
          } ${isEditable ? "cursor-pointer hover:underline" : ""}`}
          title={isEditable ? "Click to edit name" : undefined}
        >
          {name}
        </span>
      )}

      {/* Captured pieces */}
      {capturedPieces.length > 0 && (
        <span className="text-sm tracking-tight ml-auto">
          {capturedPieces.join("")}
        </span>
      )}
    </div>
  );
}
