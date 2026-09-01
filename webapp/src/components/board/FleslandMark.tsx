interface FleslandMarkProps {
  className?: string;
}

/**
 * The board logo: an airliner seen from above, climbing out of a ringed
 * signage badge — the same pictogram language as the split-flap board.
 */
export function FleslandMark({ className }: FleslandMarkProps) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Logo for Flesland-tavlen" className={className}>
      <circle cx="32" cy="32" r="30.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <g transform="rotate(-20 32 32)">
        <path
          d="M32 7.5
             C34.3 7.5 36 11 36.3 15.8
             L36.9 26.8
             L55.5 35.2
             L55.5 43
             L37.1 35.6
             L37.1 45.4
             L42.6 50.2
             L42.6 54
             L32 51.2
             L21.4 54
             L21.4 50.2
             L26.9 45.4
             L26.9 35.6
             L8.5 43
             L8.5 35.2
             L27.1 26.8
             L27.7 15.8
             C28 11 29.7 7.5 32 7.5
             Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
