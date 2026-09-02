import type { ReactNode } from "react";
import { PlaneLanding, PlaneTakeoff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionPlateProps {
  title: string;
  /** Landing icon for arrivals, take-off for departures. */
  arriving: boolean;
  /** Small line after the title — "5 fly", "ADS-B av", "· · ·". */
  note: string;
  /** Optional controls pinned to the right end of the plate. */
  actions?: ReactNode;
}

/**
 * The yellow signage plate that caps every board — modelled on the real
 * airport "Departures" sign: a flat chrome-yellow panel with a dark rule top
 * and bottom, a round near-black icon badge, and heavy dark lettering.
 */
export function SectionPlate({ title, arriving, note, actions }: SectionPlateProps) {
  return (
    <div
      className={cn(
        "signage-plate flex flex-wrap items-center justify-between gap-2 rounded-t-[3px]",
        "border border-b-0 border-board-frame px-3 py-2.5"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8"
          style={{ background: "hsl(var(--plate-ink))" }}
        >
          {arriving ? (
            <PlaneLanding className="h-4 w-4 text-plate sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
          ) : (
            <PlaneTakeoff className="h-4 w-4 text-plate sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
          )}
        </span>
        <h2 className="font-signage text-lg font-semibold uppercase tracking-[0.14em] text-plate-ink sm:text-xl">
          {title}
        </h2>
        <span className="font-signage text-[10px] uppercase tracking-[0.2em] text-plate-ink/70">
          {note}
        </span>
      </div>
      {actions ? <div className="flex items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
