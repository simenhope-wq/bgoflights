import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import {
  actualInstant,
  currentShiftInOslo,
  hasDeparted,
  hasLanded,
  isCancelled,
  isGateClosed,
  type Flight,
  type FlightBoard,
  type Shift,
} from "@/lib/flights";
import { SplitFlapText } from "./SplitFlapText";

/** Passport control opens this long before an outgoing flight's departure. */
export const CONTROL_OPENS_BEFORE_MS = 60 * 60_000;
/**
 * Once control has opened, the UT countdown stops sinking further than this —
 * fifteen minutes past control-open it stops showing digits altogether and
 * reads "KONTROLL" (red) instead, until the flight is actually handled (see
 * isUtDone below) rather than one flight handing off to the next the instant
 * the floor is hit.
 */
export const OVERDUE_FLOOR_MS = -15 * 60_000;

/**
 * How long a just-landed arrival keeps showing "KONTROLL" on the INN side
 * before the countdown moves on to the next incoming flight's ETA.
 */
export const INN_CONTROL_PHASE_MS = 10 * 60_000;

/**
 * Both rows turn amber inside this window before their target instant —
 * control-open for UT, ETA for INN — as a "coming up soon" cue, and
 * ControlChime (a separate, singly-mounted component — see that file for
 * why) plays the chime the moment either one first crosses into it.
 */
export const SOON_THRESHOLD_MS = 5 * 60_000;

/**
 * A departure is done with UT — no longer the flight the countdown is
 * tracking — once it has actually left, or once its gate has closed
 * (whichever Avinor reports first; a flight can depart without ever
 * showing "Gate closed" if that particular update never comes through).
 */
export function isUtDone(flight: Flight): boolean {
  return hasDeparted(flight) || isGateClosed(flight);
}

/**
 * The soonest not-yet-done, not-cancelled flight in a list, by its current
 * best-known time. Exported so ControlChime can track the exact same flight
 * this panel is displaying, rather than re-deriving it slightly differently.
 */
export function nextPending(flights: Flight[], isDone: (f: Flight) => boolean): Flight | null {
  let best: Flight | null = null;
  let bestAt = Infinity;
  for (const f of flights) {
    if (isCancelled(f) || isDone(f)) continue;
    const at = actualInstant(f);
    if (at !== null && at < bestAt) {
      best = f;
      bestAt = at;
    }
  }
  return best;
}

/**
 * The most recently landed, not-cancelled arrival that is still inside its
 * post-landing "KONTROLL" window (see INN_CONTROL_PHASE_MS). If two flights
 * land close together, the later landing is what's shown — a fresh control
 * just started, superseding the one still winding down.
 */
export function activeLandedControl(flights: Flight[], now: number): Flight | null {
  let best: Flight | null = null;
  let bestAt = -Infinity;
  for (const f of flights) {
    if (isCancelled(f) || !hasLanded(f)) continue;
    const at = actualInstant(f);
    if (at !== null && at > bestAt && now - at < INN_CONTROL_PHASE_MS) {
      best = f;
      bestAt = at;
    }
  }
  return best;
}

/**
 * "HH:MM:SS", or "-HH:MM:SS" once overdue — no reserved sign slot, so the
 * common (positive) case is a clean 8-cell row with no dead blank cell
 * sitting in front of it. The row only grows to 9 cells for the "-" itself
 * once a flight is actually overdue, rather than always paying for a sign
 * character it usually isn't using.
 */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  return ms < 0 ? `-${clock}` : clock;
}

type RowTone = "green" | "amber" | "red";

const TONE_CLASS: Record<RowTone, string> = {
  green: "text-flap-green",
  amber: "text-flap-amber",
  red: "text-flap-red",
};

function ControlRow({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: RowTone;
}) {
  // Always the same flap row, whether it's counting down, reads "KONTROLL",
  // or reads "FERDIG" — one component, one line-height, so nothing about
  // the row's own size changes when it flips between them (that mismatch
  // used to nudge the whole page by a few pixels on every shift switch).
  return (
    <div className="flex items-center gap-2">
      {/* The page's header wraps everything in text-center for FLESLAND's
          sake, which was inherited here too — centering "UT"/"INN" inside
          their fixed-width box instead of flushing them left under the
          icon above, and (since "UT" and "INN" aren't the same length)
          throwing the two labels out of alignment with each other as well.
          text-left overrides that inheritance. */}
      <span className="w-8 shrink-0 text-left font-signage text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {/* Width tracks the text itself (no fixed reservation) — "FERDIG" is
          6 cells, "KONTROLL" is 8, a normal countdown is 8, and an overdue
          one grows to 9 for its "-", rather than every row always paying
          for a sign character it usually isn't using. */}
      <SplitFlapText
        value={text}
        width={text.length}
        flipKey={text}
        className={cn("flap-title text-[15px]", TONE_CLASS[tone])}
        ariaLabel={`${label} ${text}`}
      />
    </div>
  );
}

/**
 * "Neste kontroll" — a live countdown to the next passport-control moment
 * in each direction, shown both beside the FLESLAND title on desktop and
 * as its own centred block under the shift filter on mobile (each call
 * site controls visibility/layout around it; this component has no
 * built-in breakpoint of its own):
 * - UT: the next outgoing flight's control-open time (departure minus one
 *   hour, per BGO procedure). It turns amber inside the last five minutes
 *   before that (SOON_THRESHOLD_MS), then red once it opens, counting into
 *   the negative; fifteen minutes past that (OVERDUE_FLOOR_MS) it stops
 *   showing digits and reads "KONTROLL" instead, staying on that flight
 *   until it actually departs or its gate closes (isUtDone) — whichever
 *   Avinor reports first — at which point the countdown hands off to the
 *   next departure.
 * - INN: the next incoming flight's current ETA, floored at zero once it's
 *   due, and amber for the same five-minute run-up as UT. Once it lands,
 *   the row reads "KONTROLL" (red, same word and tone as UT's) for ten
 *   minutes (INN_CONTROL_PHASE_MS) before switching over to the next
 *   arrival's countdown — passport control on a landed flight isn't
 *   instantaneous, so the row keeps saying so for a bit rather than
 *   silently jumping straight to the next flight's ETA.
 * A separate, singly-mounted ControlChime component (this panel is mounted
 * twice — desktop and mobile, toggled with CSS, not conditional rendering)
 * plays a chime the moment either side first enters its amber window.
 * Follows the shift currently selected on screen (`shift`, i.e. the
 * Dagskift/Kveldskift toggle) so it always matches whatever board is
 * actually showing below it — switch to Kveldskift mid-afternoon and the
 * countdown switches with it. Only when nothing is selected ("Alle") does
 * it fall back to whichever shift is actually on duty right now (real Oslo
 * wall-clock time via currentShiftInOslo), since there's no explicit
 * selection to follow. Each row independently reads "FERDIG" — in the same
 * flap style as the countdown itself, just with different text — once
 * there's nothing left to wait for on that side. (No checkmark: the flap
 * drum only has letters, digits and a handful of punctuation — see
 * SplitFlapText's CHARSET — same as every other flap row on the board.)
 */
export function NextControlPanel({
  dayBoard,
  nightBoard,
  shift,
  layout = "stacked",
}: {
  dayBoard: FlightBoard;
  nightBoard: FlightBoard;
  shift: Shift | null;
  /**
   * "stacked" (default): UT above INN — used beside FLESLAND on desktop,
   * where the panel is a narrow sidebar column with height to spare.
   * "row": UT and INN side by side on one line — used on mobile, where
   * the panel sits full-width in the page flow and vertical space is the
   * thing worth saving.
   */
  layout?: "stacked" | "row";
}) {
  const now = useNow(1_000);
  const board = (shift ?? currentShiftInOslo(now)) === "day" ? dayBoard : nightBoard;

  const departure = nextPending(board.departures, isUtDone);
  const departureAt = departure ? actualInstant(departure) : null;
  const rawUtMs = departureAt !== null ? departureAt - CONTROL_OPENS_BEFORE_MS - now : null;
  const utOverdue = rawUtMs !== null && rawUtMs <= 0;
  const utSoon = rawUtMs !== null && rawUtMs > 0 && rawUtMs <= SOON_THRESHOLD_MS;
  const utControlPhase = rawUtMs !== null && rawUtMs <= OVERDUE_FLOOR_MS;
  const utMs = rawUtMs !== null ? Math.max(rawUtMs, OVERDUE_FLOOR_MS) : null;
  const utTone: RowTone = departure === null ? "green" : utOverdue ? "red" : utSoon ? "amber" : "green";

  const landedControl = activeLandedControl(board.arrivals, now);
  const arrival = landedControl ? null : nextPending(board.arrivals, hasLanded);
  const arrivalAt = arrival ? actualInstant(arrival) : null;
  const innMs = arrivalAt !== null ? Math.max(arrivalAt - now, 0) : null;
  const innSoon = arrivalAt !== null && arrivalAt - now <= SOON_THRESHOLD_MS;
  const innTone: RowTone = landedControl ? "red" : innSoon ? "amber" : "green";

  const utRow = (
    <ControlRow
      label="UT"
      text={departure === null ? "FERDIG" : utControlPhase ? "KONTROLL" : formatCountdown(utMs ?? 0)}
      tone={utTone}
    />
  );
  const innRow = (
    <ControlRow
      label="INN"
      text={landedControl ? "KONTROLL" : arrival === null ? "FERDIG" : formatCountdown(innMs ?? 0)}
      tone={innTone}
    />
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-1 whitespace-nowrap",
        layout === "row" ? "items-center text-center" : "text-left"
      )}
    >
      <span className="flex items-center gap-1.5 font-signage text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <img
          src="/icons/next-control.png"
          alt=""
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0"
        />
        Neste kontroll:
      </span>
      {layout === "row" ? (
        <div className="flex items-center gap-5">
          {utRow}
          {innRow}
        </div>
      ) : (
        <>
          {utRow}
          {innRow}
        </>
      )}
    </div>
  );
}
