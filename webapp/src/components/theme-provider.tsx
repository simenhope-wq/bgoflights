import { ReactNode, useCallback, useEffect, useState } from "react";
import { ThemeContext, type Theme } from "@/hooks/use-theme";

const STORAGE_KEY = "flesland-theme";

// Read the saved choice before the first paint, so the page never flashes the
// wrong mode on reload. The board is a backlit panel — it belongs on a dark
// page, so dark is the default until the user picks otherwise.
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Private mode / storage disabled — fall through to the dark default.
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private mode / storage disabled — the choice just won't persist.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}
