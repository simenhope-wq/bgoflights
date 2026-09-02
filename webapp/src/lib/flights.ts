/**
 * Flight board types + helpers.
 * The board covers flights crossing the Schengen border only (to/from outside Schengen).
 * Mirrors the Zod contract in backend/src/types.ts (FlightSchema / FlightBoardSchema).
 */

export interface Flight {
  id: string;
  flightId: string;
  airline: string;
  airlineName: string;
  airportCode: string;
  airportName: string;
  scheduleTime: string;
  scheduled: string;
  estimated: string;
  timeChanged: boolean;
  /** Arrivals only: the aircraft has left its origin and is on its way here. */
  leftOrigin: boolean;
  statusCode: string;
  statusText: string;
  /** Passenger-facing gate stage from Avinor; empty when none is displayed there. */
  operationalStatus: string;
  gate: string;
  belt: string;
  /** ISO country of the other airport, "" when unknown */
  country: string;
  /** Country is an EU member state */
  eu: boolean;
  /** Why the flight is on the board */
  basis: "avinor-flag" | "country-list" | "unresolved";
  /**
   * Set client-side when the flight belongs to the day *after* the selected
   * date — the small-hours tail of the night shift. Never sent by the API.
   */
  nextDay?: boolean;
}

/** The board's own border-check report — see backend CoverageSchema. */
export interface Coverage {
  inWindow: number;
  byAvinorFlag: { I: number; S: number; D: number; other: number };
  included: number;
  countryResolved: number;
  addedByCountryList: {
    flightId: string;
    airportCode: string;
    country: string;
    avinorFlag: string;
  }[];
  flagDisagreements: { flightId: string; airportCode: string; country: string }[];
  unresolved: string[];
  countries: { code: string; eu: boolean; flights: number }[];
  countryCheckSkipped: boolean;
  reference: {
    reviewed: string;
    schengenCountries: number;
    euCountries: number;
    rule: string;
  };
}

export const emptyCoverage = (): Coverage => ({
  inWindow: 0,
  byAvinorFlag: { I: 0, S: 0, D: 0, other: 0 },
  included: 0,
  countryResolved: 0,
  addedByCountryList: [],
  flagDisagreements: [],
  unresolved: [],
  countries: [],
  countryCheckSkipped: false,
  reference: { reviewed: "", schengenCountries: 0, euCountries: 0, rule: "" },
});

export interface FlightBoard {
  date: string;
  airport: string;
  airportName: string;
  arrivals: Flight[];
  departures: Flight[];
  lastUpdate: string;
  notice: string | null;
  coverage: Coverage;
}

/** A private / non-scheduled jet movement, from ADS-B rather than Avinor. */
export interface PrivateJet {
  id: string;
  kind: "arrival" | "departure";
  callsign: string;
  time: string;
  timeIso: string;
  airportCode: string;
  airportName: string;
  country: string;
  /** ADS-B could not resolve the other end of the flight */
  unknownRoute: boolean;
  /** Client-side: belongs to the day after the selected date. */
  nextDay?: boolean;
}

export interface PrivateJetBoard {
  date: string;
  movements: PrivateJet[];
  /** Non-scheduled movements seen at BGO before the Schengen filter */
  checked: number;
  /** Of those, how many had no resolvable other airport */
  unknownRoutes: number;
  /** False when ADS-B tracking is not switched on yet */
  available: boolean;
  notice: string | null;
}

const OSLO_TZ = "Europe/Oslo";

/** Today in Bergen local time, as YYYY-MM-DD. */
export function todayInOslo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Shift a YYYY-MM-DD date by whole days. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "torsdag 27. august 2026" */
export function formatLongDate(date: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** "tor 27 aug" — compact label for the date stepper, sized for ten flaps. */
export function formatShortDate(date: string): string {
  const parts = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(`${date}T12:00:00Z`));
  const get = (type: string) => parts.find((p) => p.type === type)?.value.replace(".", "") ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

/**
 * Relative day label for the neighbouring days only — "I går", "I dag",
 * "I morgen". Anything further out gets no label; the date itself says enough.
 */
export function relativeDayLabel(date: string): string {
  const today = todayInOslo();
  const diff = Math.round(
    (new Date(`${date}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) /
      86_400_000
  );
  if (diff === 0) return "I dag";
  if (diff === 1) return "I morgen";
  if (diff === -1) return "I går";
  return "";
}

export function isCancelled(flight: Flight): boolean {
  return flight.statusCode === "C";
}

/** Avinor status "D" ("Avreist") — the aircraft has left the ground. */
export function hasDeparted(flight: Flight): boolean {
  return flight.statusCode === "D";
}

/** Avinor status "A" ("Landet") — the aircraft is on the ground here. */
export function hasLanded(flight: Flight): boolean {
  return flight.statusCode === "A";
}

/** How long a landing stays "fresh" on the board before it fades to grey. */
export const LANDED_FRESH_MS = 30 * 60 * 1000;

/**
 * The instant the flight actually operates: its scheduled UTC stamp shifted by
 * whatever delay the airline has announced. Null when Avinor sent no stamp.
 */
export function actualInstant(flight: Flight): number | null {
  const scheduled = Date.parse(flight.scheduleTime);
  if (Number.isNaN(scheduled)) return null;
  return scheduled + delayMinutes(flight) * 60_000;
}

/** Landed, and long enough ago that the row is no longer news. */
export function landedLongAgo(flight: Flight, now: number): boolean {
  if (!hasLanded(flight)) return false;
  const at = actualInstant(flight);
  return at !== null && now - at >= LANDED_FRESH_MS;
}

const minutesOf = (time: string): number | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/** Minutes the published time runs behind schedule (negative when early). */
export function delayMinutes(flight: Flight): number {
  const scheduled = minutesOf(flight.scheduled);
  const estimated = minutesOf(flight.estimated);
  if (scheduled === null || estimated === null) return 0;
  let diff = estimated - scheduled;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

export type Shift = "day" | "night";

/**
 * Day shift: 04:00 up to (but not including) 16:00. It starts at 04:00 because
 * the night shift below reaches to 04:00 — so the small hours belong to the
 * *previous* day's night shift rather than this day's.
 *
 * The two shifts overlap on purpose between 15:00 and 16:00: that hour is the
 * handover, and those flights are listed under both shifts.
 */
const DAY_START_MINUTES = 4 * 60;
const DAY_END_MINUTES = 16 * 60;
/**
 * Night shift starts at 15:00 — deliberately one hour before the day shift
 * ends, so flights between 15:00 and 16:00 appear in *both* shifts (handover).
 */
const NIGHT_START_MINUTES = 15 * 60;
/** … and runs to 04:00 the *following* morning. */
const NIGHT_END_MINUTES = 4 * 60;

/** Anything at or after this belongs to the next day's day shift, not tonight. */
const isNightTail = (mins: number) => mins < NIGHT_END_MINUTES;

export function isInDayShift(flight: Flight | PrivateJet): boolean {
  // A next-day movement is only ever the tail of the previous night.
  if (flight.nextDay) return false;
  const mins = minutesOf(shiftTimeOf(flight));
  return mins !== null && mins >= DAY_START_MINUTES && mins < DAY_END_MINUTES;
}

export function isInNightShift(flight: Flight | PrivateJet): boolean {
  const mins = minutesOf(shiftTimeOf(flight));
  if (mins === null) return false;
  return flight.nextDay ? isNightTail(mins) : mins >= NIGHT_START_MINUTES;
}

/** Flights carry `scheduled`, jets carry `time`. */
const shiftTimeOf = (item: Flight | PrivateJet): string =>
  "scheduled" in item ? item.scheduled : item.time;

/** Orders a night shift correctly across midnight: 16:00 … 23:59, 00:00 … 03:59. */
export function shiftSortKey(item: Flight | PrivateJet): number {
  const mins = minutesOf(shiftTimeOf(item)) ?? 0;
  return item.nextDay ? mins + 1440 : mins;
}

const inShift = (item: Flight | PrivateJet, shift: Shift): boolean =>
  shift === "day" ? isInDayShift(item) : isInNightShift(item);

/**
 * Narrows a board to one shift. The night shift reaches past midnight, so the
 * small hours of `nextBoard` are folded in and tagged `nextDay`.
 */
export function boardForShift(
  board: FlightBoard,
  nextBoard: FlightBoard | undefined,
  shift: Shift | null
): FlightBoard {
  if (!shift) return board;

  const pick = (own: Flight[], tail: Flight[]): Flight[] => {
    const kept: Flight[] = own.filter((f) => inShift(f, shift));
    if (shift === "night") {
      for (const f of tail) {
        const tagged: Flight = { ...f, nextDay: true };
        if (isInNightShift(tagged)) kept.push(tagged);
      }
    }
    return kept.sort((a, b) => shiftSortKey(a) - shiftSortKey(b));
  };

  return {
    ...board,
    arrivals: pick(board.arrivals, nextBoard?.arrivals ?? []),
    departures: pick(board.departures, nextBoard?.departures ?? []),
  };
}

/** Same narrowing for the ADS-B private jet board. */
export function jetsForShift(
  board: PrivateJetBoard | undefined,
  nextBoard: PrivateJetBoard | undefined,
  shift: Shift | null
): PrivateJetBoard | undefined {
  if (!board || !shift) return board;

  const kept: PrivateJet[] = board.movements.filter((m) => inShift(m, shift));
  if (shift === "night") {
    for (const m of nextBoard?.movements ?? []) {
      const tagged: PrivateJet = { ...m, nextDay: true };
      if (isInNightShift(tagged)) kept.push(tagged);
    }
  }

  return {
    ...board,
    movements: kept.sort((a, b) => shiftSortKey(a) - shiftSortKey(b)),
  };
}

/** Treated as delayed once it slips five minutes or more. */
export function isDelayed(flight: Flight): boolean {
  return flight.timeChanged && delayMinutes(flight) >= 5;
}

/** Early when it arrives/departs earlier than scheduled. */
export function isEarly(flight: Flight): boolean {
  return flight.timeChanged && delayMinutes(flight) < -5;
}

/** New time announced but not delayed (delay < 5 min or early). */
export function isNewTime(flight: Flight): boolean {
  return flight.timeChanged && !isDelayed(flight) && !isEarly(flight);
}

/**
 * Time to show as ETA/ETD. Blank unless Avinor has published a new time — the
 * scheduled time is already in the column next to it.
 */
export function displayTime(flight: Flight): string {
  return flight.estimated;
}

/**
 * Flightradar24's page for a flight number — live map while the aircraft is in
 * the air, route history otherwise. Just a link: no key, no quota.
 */
export function flightRadarUrl(flight: Flight): string {
  return `https://www.flightradar24.com/data/flights/${flight.flightId.replace(/\s+/g, "").toLowerCase()}`;
}

/** Worth offering a live track: inbound, airborne, and not down yet. */
export function isTrackable(flight: Flight): boolean {
  return flight.leftOrigin && !hasLanded(flight) && !isCancelled(flight);
}

export type StatusTone = "ink" | "dim" | "amber" | "red" | "green";

export interface FlightStatus {
  label: string;
  tone: StatusTone;
}

/**
 * The status word shown on the board. Derived from the same facts as the ETA
 * column rather than echoing Avinor's raw status text, so the two can never
 * disagree — a flight cannot read "Ny tid" next to an empty ETA, and one that
 * shows no new time reads "I rute".
 */
export function flightStatus(
  flight: Flight,
  now: number,
  kind: "arrivals" | "departures"
): FlightStatus {
  if (isCancelled(flight)) return { label: "INNSTILT", tone: "red" };
  if (hasLanded(flight)) {
    return { label: "LANDET", tone: landedLongAgo(flight, now) ? "dim" : "green" };
  }
  if (flight.operationalStatus) {
    const label = flight.operationalStatus.toUpperCase();
    if (label === "BOARDING") return { label, tone: "green" };
    if (label === "GATE CLOSING") return { label, tone: "red" };
    if (label === "GATE CLOSED") return { label, tone: "dim" };
    return { label, tone: "amber" };
  }
  // "Avreist" means gone from Bergen on the departure board, and left the
  // origin city on the arrival board. An inbound that is in the air says so
  // even when it is running late — the ETA column carries the delay in red.
  if (kind === "arrivals" && flight.leftOrigin) {
    return { label: "AVREIST", tone: isDelayed(flight) ? "red" : "ink" };
  }
  if (hasDeparted(flight)) return { label: "AVREIST", tone: "dim" };
  if (isDelayed(flight)) return { label: "FORSINKET", tone: "red" };
  if (flight.timeChanged) return { label: "NY TID", tone: "amber" };
  return { label: "I RUTE", tone: "ink" };
}

/**
 * One piece of a copy: either a line of text or a table. Copies are built as
 * blocks so the same data can go on the clipboard twice — as an HTML table
 * (what PowerPoint pastes) and as tab separated text (the fallback).
 */
export type CopyBlock =
  | { kind: "heading"; text: string }
  | { kind: "table"; title: string; header: string[]; rows: string[][]; empty: string };

/**
 * A section as a copy block. A title line, a header row, then three columns —
 * the scheduled time (never the estimated one), the origin / destination, and
 * the flight number.
 */
function sectionBlocks(title: string, placeLabel: string, flights: Flight[]): CopyBlock[] {
  return [
    {
      kind: "table",
      title,
      header: ["TID", placeLabel, "FLIGHTNUMMER"],
      rows: flights.map((f) => [
        f.nextDay ? `${f.scheduled} (+1)` : f.scheduled,
        f.airportName,
        f.flightId,
      ]),
      empty: "Ingen fly oppført",
    },
  ];
}

/** Copy blocks for a single section (arrivals or departures), optionally filtered to a shift. */
export function buildSectionBlocks(
  board: FlightBoard,
  kind: "arrivals" | "departures",
  shift?: Shift
): CopyBlock[] {
  // The board is already narrowed by boardForShift(); filtering again is a
  // no-op safeguard for callers that pass a full board.
  const flights = kind === "arrivals" ? board.arrivals : board.departures;
  const filtered = shift ? flights.filter((f) => inShift(f, shift)) : flights;
  return kind === "arrivals"
    ? sectionBlocks("ANKOMST", "FRA", filtered)
    : sectionBlocks("AVGANG", "TIL", filtered);
}

/** First line of every copy — the airport and the day the board is showing. */
export const boardHeading = (date: string): CopyBlock => ({
  kind: "heading",
  text: `BERGEN LUFTHAVN (${formatLongDate(date)})`,
});

/** Copy blocks for the private jet box — same columns, plus in/out. */
export function buildPrivateJetBlocks(movements: PrivateJet[]): CopyBlock[] {
  return [
    {
      kind: "table",
      title: "PRIVATFLY",
      header: ["TID", "INN/UT", "FRA/TIL", "KALLESIGNAL"],
      rows: movements.map((m) => [
        m.nextDay ? `${m.time} (+1)` : m.time,
        m.kind === "arrival" ? "Inn" : "Ut",
        m.unknownRoute ? "Ukjent rute (ADS-B)" : m.airportName,
        m.callsign,
      ]),
      empty: "Ingen privatfly oppført",
    },
  ];
}

/** Copy blocks for the whole board, optionally filtered to a shift. */
export function buildBoardBlocks(
  board: FlightBoard,
  jets?: PrivateJetBoard | null,
  shift?: Shift
): CopyBlock[] {
  const blocks = [
    boardHeading(board.date),
    ...buildSectionBlocks(board, "departures", shift),
    ...buildSectionBlocks(board, "arrivals", shift),
  ];
  if (jets?.available) {
    blocks.push(...buildPrivateJetBlocks(jets.movements));
  }
  return blocks;
}

/**
 * How many characters fit between two of PowerPoint's tab stops. The stops are
 * a fixed distance apart (2.54 cm by default), so this depends on the font
 * size: the bigger the text, the fewer characters reach the next stop. Tuned
 * for 16 pt — raise it for smaller text, lower it for bigger.
 */
const CHARS_PER_TAB = 9;

/**
 * Lays rows out on tab stops. A single tab between columns only lines up while
 * every value is short: one long destination name eats the next stop and drags
 * the rest of that row — and the header row — out of line. Giving each column a
 * fixed number of stops, wide enough for its longest value, keeps the header
 * sitting straight above its column.
 */
function tabRows(header: string[], rows: string[][]): string[] {
  const all = [header, ...rows];
  const columns = header.length;
  // Where each column starts, counted in tab stops.
  const starts = [0];
  for (let i = 0; i < columns; i++) {
    const widest = Math.max(...all.map((row) => (row[i] ?? "").length));
    starts.push(starts[i] + Math.floor(widest / CHARS_PER_TAB) + 1);
  }
  // The flight number sits one extra stop out, clear of the place names.
  starts[columns - 1] += 1;
  return all.map((row) =>
    row
      .map((cell, i) => {
        if (i === row.length - 1) return cell;
        // Tabs left to reach this column's next stop from where the cell ends.
        const tabs = starts[i + 1] - starts[i] - Math.floor(cell.length / CHARS_PER_TAB);
        return cell + "\t".repeat(Math.max(1, tabs));
      })
      .join("")
  );
}

/** The whole copy as tab separated lines. */
function blocksToText(blocks: CopyBlock[]): string {
  return blocks
    .map((block) => {
      if (block.kind === "heading") return block.text;
      if (block.rows.length === 0) {
        return [block.title, block.header.join("\t"), block.empty].join("\n");
      }
      return [block.title, ...tabRows(block.header, block.rows)].join("\n");
    })
    .join("\n\n");
}

/**
 * Puts a copy on the clipboard as plain text only — no HTML flavour, so
 * PowerPoint always pastes these exact tabs instead of rebuilding the layout
 * its own way, and the slide keeps its own font.
 */
export async function copyBlocks(blocks: CopyBlock[]): Promise<boolean> {
  const text = blocksToText(blocks);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea fallback */
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
