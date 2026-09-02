import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Shift } from "@/lib/flights";

interface ShiftFilterProps {
  value: Shift | null;
  onChange: (value: Shift | null) => void;
  className?: string;
}

const OPTIONS: { value: Shift | null; label: string; hint: string }[] = [
  { value: null, label: "Alle", hint: "Hele døgnet" },
  { value: "day", label: "Dagskift", hint: "04:00-16:00" },
  { value: "night", label: "Kveldskift", hint: "15:00-04:00 (+1)" },
];

/** Segmented control that narrows the board to one shift. */
export function ShiftFilter({ value, onChange, className }: ShiftFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filtrer på skift"
      className={cn(
        // sm:h-8 matches CopyButton, so the two controls read as one set.
        "inline-flex shrink-0 items-center rounded-[2px] border border-board/35 p-[2px] dark:border-foreground/30 sm:h-8",
        className
      )}
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.label}
            type="button"
            title={option.hint}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-1 rounded-[1px] px-1.5 py-1 font-signage text-[8px] font-medium uppercase tracking-[0.08em] transition-colors sm:h-full sm:px-2.5 sm:py-0 sm:text-[10px] sm:tracking-[0.18em]",
              active
                ? "bg-board text-flap-ink dark:bg-foreground dark:text-background"
                : "text-board/60 hover:bg-board/10 hover:text-board dark:text-foreground/60 dark:hover:bg-foreground/10 dark:hover:text-foreground"
            )}
          >
            {option.value === "day" ? (
              <Sun className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            ) : option.value === "night" ? (
              <Moon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
