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
 */
export function OsloClock({ className }: { className?: string }) {
  const now = useNow(1_000);
  return (
    <time className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatter.format(new Date(now))}
    </time>
  );
}
