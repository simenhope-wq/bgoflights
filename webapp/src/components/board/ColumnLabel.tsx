import { cn } from "@/lib/utils";

interface ColumnLabelProps {
  label: string;
  /** Flap count of the column this labels — must match the SplitFlapText width. */
  width: number;
  className?: string;
}

/**
 * A screen-printed column label sized to sit exactly above its flap column.
 *
 * The width has to be measured in the *row's* font, not the label's: a flap cell
 * is 1.08ch wide with a 1.5px seam between cells, and `ch` resolves against the
 * element's own font-size. So the box carries the row's font metrics — the same
 * text-[12px]/sm:text-[18px] the flap rows use, keep them in sync — and the
 * label text is shrunk inside it.
 */
export function ColumnLabel({ label, width, className }: ColumnLabelProps) {
  return (
    <span
      className={cn("inline-block shrink-0 text-[12px] font-semibold sm:text-[18px]", className)}
      style={{ width: `calc(${width * 1.08}ch + ${(width - 1) * 1.5}px)` }}
    >
      <span className="block whitespace-nowrap font-signage text-[9px] uppercase tracking-[0.18em] sm:text-[11px]">
        {label}
      </span>
    </span>
  );
}
