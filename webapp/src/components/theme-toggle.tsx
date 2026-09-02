import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Mørk modus" : "Lys modus"}
      title={theme === "light" ? "Mørk modus" : "Lys modus"}
      className="h-7 w-7 shrink-0 rounded-[2px] text-muted-foreground hover:bg-secondary hover:text-foreground sm:h-8 sm:w-8"
    >
      {theme === "light" ? (
        <Moon className="h-3.5 w-3.5" />
      ) : (
        <Sun className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
