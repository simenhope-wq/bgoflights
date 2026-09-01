import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatShortDate, relativeDayLabel, todayInOslo } from "@/lib/flights";
import { SplitFlapText } from "./SplitFlapText";

interface DateStepperProps {
  date: string;
  onShift: (days: number) => void;
  onToday: () => void;
}

// The whole stepper is 32px tall — on desktop that matches the copy buttons,
// on a phone it keeps the control compact next to the refresh button.
const ARROW_CLASS =
  "h-8 w-8 rounded-[2px] border border-board-frame bg-board text-flap-ink transition-colors hover:bg-flap hover:text-flap-amber active:translate-y-[1px] sm:w-8";

/** Arrows step one day at a time; the date itself is a small split-flap module. */
export function DateStepper({ date, onShift, onToday }: DateStepperProps) {
  const isToday = date === todayInOslo();
  const label = relativeDayLabel(date);

  return (
    // The "I dag" line sits above the stepper and always occupies a row, so the
    // controls below keep the exact same size when you step away from today.
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-4 items-center justify-center sm:h-6">
        {isToday ? (
          <span className="font-signage text-[9px] uppercase tracking-[0.18em] text-flap-amber sm:text-[13px]">
            {label}
          </span>
        ) : label ? (
          // Off today, the label doubles as the way back.
          <button
            type="button"
            onClick={onToday}
            title="Tilbake til i dag"
            className="rounded-[1px] px-1 font-signage text-[9px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground sm:text-[13px]"
          >
            {label}
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Forrige dag"
          onClick={() => onShift(-1)}
          className={ARROW_CLASS}
        >
          <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>

        <div
          className="flex h-8 items-center rounded-[2px] border border-board-frame px-1.5 sm:px-2.5"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 0%, hsl(var(--board)) 0%, hsl(var(--board-deep)) 100%)",
          }}
        >
          <SplitFlapText
            value={formatShortDate(date)}
            width={10}
            flipKey={date}
            className="text-[10px] leading-tight text-flap-ink sm:text-[18px]"
            ariaLabel={formatShortDate(date)}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Neste dag"
          onClick={() => onShift(1)}
          className={ARROW_CLASS}
        >
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  );
}
