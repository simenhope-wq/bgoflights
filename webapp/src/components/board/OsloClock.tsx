import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Live Bergen wall clock, ticking every second. Kept in its own component so
 * the per-second tick re-renders the clock alone and never the flight board.
 *
 * Renders each character in its own fixed-width slot rather than leaning on
 * tabular-nums — the ambient font's digit glyphs aren't perfectly equal
 * width, so the string's total rendered width crept by a pixel or two as
 * digits changed, nudging this block (and its flex neighbours in the top
 * bar) sideways every second. Fixed slots keep the total width constant.
 */
export function OsloClock({ className }: { className?: string }) {
  const now = useNow(1_000);
  const value = formatter.format(new Date(now));

  return (
    <time className={cn("inline-flex", className)}>
      {value.split("").map((char, i) => (
        <span
          key={i}
          className={
            char === ":"
              ? "inline-block w-[0.45em] text-center"
              : "inline-block w-[0.78em] text-center"
          }
        >
          {char}
        </span>
      ))}
    </time>
  );
}
