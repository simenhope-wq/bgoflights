import { cn } from "@/lib/utils";

/** Twelve upright five-pointed stars in a circle — the EU / Schengen mark. */
const RING_RADIUS = 7.6;
const OUTER = 1.75;
/** Golden-ratio inner radius, the classic five-pointed star proportion. */
const INNER = OUTER * 0.382;

function star(index: number): string {
  const ringAngle = (Math.PI / 6) * index - Math.PI / 2;
  const cx = 12 + RING_RADIUS * Math.cos(ringAngle);
  const cy = 12 + RING_RADIUS * Math.sin(ringAngle);

  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? OUTER : INNER;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return points.join(" ");
}

const STARS = Array.from({ length: 12 }, (_, i) => star(i));

export function EuStars({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Schengen"
    >
      <title>Schengen</title>
      {STARS.map((points, i) => (
        <polygon key={i} points={points} fill="#FFCC00" />
      ))}
    </svg>
  );
}
