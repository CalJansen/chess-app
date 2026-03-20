"use client";

import { useState, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { gameToPGN, pgnToMoves } from "@/utils/pgn";

interface PGNModalProps {
  history: string[];
  result: string;
  onImport: (moves: string[]) => void;
  onClose: () => void;
}

export default function PGNModal({ history, result, onImport, onClose }: PGNModalProps) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<"export" | "import">("export");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pgn = gameToPGN(history, result);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pgn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chess-game-${new Date().toISOString().slice(0, 10)}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportText = () => {
    try {
      const moves = pgnToMoves(importText);
      if (moves.length === 0) {
        setImportError("No valid moves found in the PGN.");
        return;
      }
      onImport(moves);
    } catch {
      setImportError("Failed to parse PGN. Check the format.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file);
  };

  const tabBtnClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
      active
        ? `${theme.panel} ${theme.textPrimary}`
        : `${theme.textMuted} hover:${theme.textSecondary}`
    }`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`${theme.statusDefault} border ${theme.panelBorder} rounded-xl w-full max-w-lg shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="flex gap-1">
            <button onClick={() => setTab("export")} className={tabBtnClass(tab === "export")}>
              Export
            </button>
            <button onClick={() => setTab("import")} className={tabBtnClass(tab === "import")}>
              Import
            </button>
          </div>
          <button
            onClick={onClose}
            className={`${theme.textMuted} hover:${theme.textPrimary} text-xl leading-none`}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {tab === "export" ? (
            <>
              <textarea
                readOnly
                value={pgn}
                className={`w-full h-48 ${theme.panel} ${theme.textSecondary} rounded-lg p-3 text-sm font-mono resize-none border ${theme.panelBorder}`}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
                >
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </button>
                <button
                  onClick={handleDownload}
                  className={`px-4 py-2 ${theme.buttonBg} ${theme.buttonHover} ${theme.buttonText} rounded-lg text-sm transition-colors`}
                >
                  Download .pgn
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError("");
                }}
                placeholder="Paste PGN here..."
                className={`w-full h-48 ${theme.panel} ${theme.textSecondary} rounded-lg p-3 text-sm font-mono resize-none border ${theme.panelBorder} placeholder:${theme.textMuted}`}
              />
              {importError && (
                <p className="text-red-400 text-sm">{importError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleImportText}
                  disabled={!importText.trim()}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors disabled:opacity-40"
                >
                  Import & Replay
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-4 py-2 ${theme.buttonBg} ${theme.buttonHover} ${theme.buttonText} rounded-lg text-sm transition-colors`}
                >
                  Upload .pgn
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pgn"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
