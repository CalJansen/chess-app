export type ThemeName = "dark" | "light" | "wood" | "blue";

export interface Theme {
  name: ThemeName;
  label: string;
  // Board square colors
  darkSquare: string;
  lightSquare: string;
  // Page & panel
  bg: string;
  panel: string;
  panelBorder: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Buttons
  buttonBg: string;
  buttonHover: string;
  buttonText: string;
  // Status colors
  statusDefault: string;
  statusDefaultBorder: string;
  statusDefaultText: string;
  // Accent (for selector preview swatch)
  swatch: string;
}

export const themes: Record<ThemeName, Theme> = {
  dark: {
    name: "dark",
    label: "Dark",
    darkSquare: "#779952",
    lightSquare: "#edeed1",
    bg: "bg-gray-900",
    panel: "bg-gray-800/50",
    panelBorder: "border-gray-700",
    textPrimary: "text-gray-100",
    textSecondary: "text-gray-200",
    textMuted: "text-gray-400",
    buttonBg: "bg-gray-700",
    buttonHover: "hover:bg-gray-600",
    buttonText: "text-gray-100",
    statusDefault: "bg-gray-800",
    statusDefaultBorder: "border-gray-700",
    statusDefaultText: "text-gray-200",
    swatch: "#1f2937",
  },
  light: {
    name: "light",
    label: "Light",
    darkSquare: "#779952",
    lightSquare: "#edeed1",
    bg: "bg-stone-100",
    panel: "bg-white/80",
    panelBorder: "border-stone-300",
    textPrimary: "text-stone-900",
    textSecondary: "text-stone-800",
    textMuted: "text-stone-500",
    buttonBg: "bg-stone-200",
    buttonHover: "hover:bg-stone-300",
    buttonText: "text-stone-900",
    statusDefault: "bg-white",
    statusDefaultBorder: "border-stone-300",
    statusDefaultText: "text-stone-800",
    swatch: "#f5f5f4",
  },
  wood: {
    name: "wood",
    label: "Wood",
    darkSquare: "#b58863",
    lightSquare: "#f0d9b5",
    bg: "bg-amber-950",
    panel: "bg-amber-900/50",
    panelBorder: "border-amber-800",
    textPrimary: "text-amber-50",
    textSecondary: "text-amber-100",
    textMuted: "text-amber-400",
    buttonBg: "bg-amber-800",
    buttonHover: "hover:bg-amber-700",
    buttonText: "text-amber-50",
    statusDefault: "bg-amber-900",
    statusDefaultBorder: "border-amber-800",
    statusDefaultText: "text-amber-100",
    swatch: "#451a03",
  },
  blue: {
    name: "blue",
    label: "Blue",
    darkSquare: "#4b7399",
    lightSquare: "#eae9d2",
    bg: "bg-slate-900",
    panel: "bg-slate-800/50",
    panelBorder: "border-slate-600",
    textPrimary: "text-slate-100",
    textSecondary: "text-slate-200",
    textMuted: "text-slate-400",
    buttonBg: "bg-slate-700",
    buttonHover: "hover:bg-slate-600",
    buttonText: "text-slate-100",
    statusDefault: "bg-slate-800",
    statusDefaultBorder: "border-slate-700",
    statusDefaultText: "text-slate-200",
    swatch: "#0f172a",
  },
};

export const themeNames: ThemeName[] = ["dark", "light", "wood", "blue"];
