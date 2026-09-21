import { useNow } from "@/hooks/use-now";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Local (Oslo) clock, ticking every second — plain white running text under
 * the date stepper, no box around it (that's DateStepper's own module just
 * above). Set in IBM Plex Mono (font-mono) to match the FLESLAND header,
 * which inherits the same body font.
 *
 * Each character still renders in its own fixed-width slot (left over from
 * chasing a jitter bug with the previous, non-monospace font) — harmless
 * now that the font itself is true monospace, and it's cheap insurance
 * against the same issue if the font ever changes again.
 */
export function LocalTimeBox() {
  const now = useNow(1_000);
  const value = formatter.format(new Date(now));

  return (
    <time className="inline-flex justify-center font-mono text-[15px] font-normal text-white sm:text-[24px]">
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
