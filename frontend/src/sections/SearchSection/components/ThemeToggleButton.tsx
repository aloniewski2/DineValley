import React from "react";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleButtonProps {
  theme: "light" | "dark";
  onToggle: () => void;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({ theme, onToggle }) => {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors
        ${
          isDark
            ? "bg-gray-900 text-gray-100 border-gray-700 hover:bg-gray-800"
            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
        }`}
      aria-pressed={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
};
