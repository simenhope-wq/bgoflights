import { useEffect, useRef } from "react";
import { useNow } from "@/hooks/use-now";
import { playChime } from "@/lib/chime";
import {
  actualInstant,
  currentShiftInOslo,
  hasLanded,
  type FlightBoard,
  type Shift,
} from "@/lib/flights";
import {
  CONTROL_OPENS_BEFORE_MS,
  SOON_THRESHOLD_MS,
  activeLandedControl,
  isUtDone,
  nextPending,
} from "./NextControlPanel";

/**
 * Plays the "five minutes to go" chime for whichever flight NextControlPanel
 * is currently counting down to, on either side (UT or INN) — the moment
 * that countdown first enters its amber window (see SOON_THRESHOLD_MS).
 *
 * Rendered exactly once, page-level. NextControlPanel itself is mounted
 * twice (desktop beside FLESLAND, mobile under the shift filter — toggled
 * with responsive CSS, not conditional rendering), so putting the sound
 * trigger inside it would double the chime up every time. This component
 * re-derives the same "which flight, how soon" facts NextControlPanel does
 * (via the shared helpers it exports) purely to drive the one-shot sound,
 * and renders nothing itself.
 */
export function ControlChime({
  dayBoard,
  nightBoard,
  shift,
  muted,
}: {
  dayBoard: FlightBoard;
  nightBoard: FlightBoard;
  shift: Shift | null;
  /**
   * While true, a flight entering its five-minute window is never marked as
   * "already chimed" — only the actual playback is skipped. So unmuting
   * mid-window immediately plays the real chime for whichever flight is
   * currently in it, rather than that flight having silently missed its
   * window forever.
   */
  muted: boolean;
}) {
  const now = useNow(1_000);
  const board = (shift ?? currentShiftInOslo(now)) === "day" ? dayBoard : nightBoard;

  const departure = nextPending(board.departures, isUtDone);
  const departureAt = departure ? actualInstant(departure) : null;
  const rawUtMs = departureAt !== null ? departureAt - CONTROL_OPENS_BEFORE_MS - now : null;

  const landedControl = activeLandedControl(board.arrivals, now);
  const arrival = landedControl ? null : nextPending(board.arrivals, hasLanded);
  const arrivalAt = arrival ? actualInstant(arrival) : null;
  const rawInnMs = arrivalAt !== null ? arrivalAt - now : null;

  // Remembers the id of the flight last chimed for on each side, so a
  // ticking clock doesn't replay the chime every second for the whole
  // five-minute window — only the first tick inside it fires, and a new
  // flight (different id) is free to chime again later.
  const utChimedFor = useRef<string | null>(null);
  const innChimedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!departure) {
      utChimedFor.current = null;
      return;
    }
    if (
      utChimedFor.current !== departure.id &&
      rawUtMs !== null &&
      rawUtMs > 0 &&
      rawUtMs <= SOON_THRESHOLD_MS
    ) {
      if (muted) return;
      utChimedFor.current = departure.id;
      playChime();
    }
  }, [departure, rawUtMs, muted]);

  useEffect(() => {
    if (!arrival) {
      innChimedFor.current = null;
      return;
    }
    if (innChimedFor.current !== arrival.id && rawInnMs !== null && rawInnMs <= SOON_THRESHOLD_MS) {
      if (muted) return;
      innChimedFor.current = arrival.id;
      playChime();
    }
  }, [arrival, rawInnMs, muted]);

  return null;
}
