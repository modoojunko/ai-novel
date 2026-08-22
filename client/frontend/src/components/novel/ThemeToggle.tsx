import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

const THEME_KEY = "ai-novel-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "novelforge");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((t) => (t === "novelforge" ? "parchment" : "novelforge"))}
      className="text-sm text-base-content/60 hover:text-base-content transition-colors p-2 rounded-md border border-base-content/10 hover:border-base-content/30"
      title={theme === "novelforge" ? "切换到浅色主题" : "切换到深色主题"}
    >
      {theme === "novelforge" ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
