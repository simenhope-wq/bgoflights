import { useNow } from "@/hooks/use-now";
import { SplitFlapText } from "./SplitFlapText";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Local (Oslo) clock, ticking every second, in the exact same split-flap
 * module DateStepper uses for the date — same box, same size — so it reads
 * as a matching pair sitting one above the other rather than a bolted-on
 * addition.
 */
export function LocalTimeBox() {
  const now = useNow(1_000);
  const value = formatter.format(new Date(now));

  return (
    <div
      className="flex h-8 items-center rounded-[2px] border border-board-frame px-1.5 sm:px-2.5"
      style={{
        background:
          "radial-gradient(120% 120% at 50% 0%, hsl(var(--board)) 0%, hsl(var(--board-deep)) 100%)",
      }}
    >
      <SplitFlapText
        value={value}
        width={8}
        flipKey={value}
        className="text-[10px] leading-tight text-flap-ink sm:text-[18px]"
        ariaLabel={value}
      />
    </div>
  );
}
