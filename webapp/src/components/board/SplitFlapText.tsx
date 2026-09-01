import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** The flap drum: every glyph the board can physically show, in drum order. */
const CHARSET = " ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ0123456789:.,-/()+&*";
const CHARS = [...CHARSET];
const INDEX = new Map(CHARS.map((ch, i) => [ch, i]));

function normalize(value: string, width: number): string {
  const upper = value.toUpperCase();
  const clean = [...upper].map((ch) => (INDEX.has(ch) ? ch : "*")).join("");
  return clean.length > width ? clean.slice(0, width) : clean.padEnd(width, " ");
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

interface SplitFlapTextProps {
  value: string;
  /** Number of cells — the text is padded or trimmed to fit. */
  width: number;
  /** Change this to re-render (e.g. when the selected date changes). */
  flipKey?: string | number;
  className?: string;
  ariaLabel?: string;
}

/**
 * A row of split-flap cells. Each cell rolls forward through the drum from the
 * glyph it was showing to the glyph it must show, so changing the date makes the
 * whole board clatter over to the new flights.
 */
export function SplitFlapText({
  value,
  width,
  flipKey,
  className,
  ariaLabel,
}: SplitFlapTextProps) {
  const target = normalize(value, width);
  const [display, setDisplay] = useState<string>(target);

  useEffect(() => {
    setDisplay(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, flipKey]);

  return (
    <span
      className={cn("inline-flex gap-[1.5px] whitespace-pre font-bold", className)}
      aria-label={ariaLabel ?? value}
    >
      {[...display].map((char, i) => (
        <span key={i} className="flap-cell" aria-hidden="true">
          {/* keyed by glyph so a change remounts it and replays the drop */}
          <span key={`${char}-${i}`} className="flap-glyph">
            {char === " " ? " " : char}
          </span>
        </span>
      ))}
    </span>
  );
}
