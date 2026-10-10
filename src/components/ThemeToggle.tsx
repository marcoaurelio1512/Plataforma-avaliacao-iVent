import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { saveTheme, type Theme } from "../lib/theme.ts";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === "light" ? "light" : "dark"));
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      aria-label={next === "light" ? "Usar tema claro" : "Usar tema escuro"}
      title={next === "light" ? "Tema claro" : "Tema escuro"}
      onClick={() => {
        saveTheme(next);
        setTheme(next);
      }}
    >
      {theme === "light" ? <Moon /> : <Sun />}
    </button>
  );
}
