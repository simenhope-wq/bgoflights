import { Hono } from "hono";
import { z } from "zod";
import {
  airlineNames,
  airportNames,
  departureOperationalStatuses,
  fetchFeed,
  operationalStatusKey,
  osloStartOfDay,
  osloTime,
  osloToday,
  statusTexts,
  type RawFlight,
} from "../lib/avinor.js";
import { iataIndex, type AirportInfo } from "../lib/opensky.js";
import { REGION_REFERENCE, classifyAirport } from "../lib/regions.js";
import type { Coverage, Flight, FlightBoard } from "../types.js";
import { cached } from "../lib/cache.js";
import { requireAuth } from "../middleware/require-auth.js";

const flightsRouter = new Hono();
flightsRouter.use("*", requireAuth);

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
});

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Avinor keeps 48h of history and roughly a week of published schedule. */
const MAX_HOURS_BACK = 48;
const MAX_HOURS_FORWARD = 300;

/**
 * Only status "E" ("Ny tid") means Avinor has published a *new* time for the
 * flight. "A" (landet) and "D" (avreist) carry the actual time the movement
 * happened — useful history, but not a delay, and treating them as one made
 * every completed flight look rescheduled. Everything else keeps its schedule.
 */
const TIME_UPDATING = new Set(["E"]);

/**
 * An arrival ETA only means something once the aircraft is on its way; before
 * that Avinor republishes small planning estimates that never reach its own
 * boards, and they read as phantom delays here.
 *
 * Avinor covers Norwegian airports only, so it cannot tell us when the flight
 * left Aberdeen or Gatwick. This window is the stand-in: every non-Schengen
 * route into Bergen is over an hour in the air (Aberdeen, the shortest, is
 * ~1h10), so inside the last hour before touchdown the flight has certainly
 * departed. Earlier than that the ETA stays blank.
 */
const AIRBORNE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Has the inbound flight left its origin, as far as we can tell? Avinor's own
 * "D" (avreist) on an arrival says so outright; otherwise the window above is
 * the stand-in.
 */
function likelyAirborne(raw: RawFlight, now: number): boolean {
  if (raw.arrDep !== "A") return true; // departures are from BGO — Avinor sees them directly
  if (raw.statusCode === "D") return true;
  const scheduled = new Date(raw.scheduleTime).getTime();
  if (Number.isNaN(scheduled)) return false;
  return now >= scheduled - AIRBORNE_WINDOW_MS;
}

function toFlight(
  raw: RawFlight,
  airports: Map<string, string>,
  airlines: Map<string, string>,
  statuses: Map<string, string>,
  operationalStatuses: Map<string, string>,
  border: BorderCheck,
  now: number
): Flight {
  const scheduled = osloTime(raw.scheduleTime);
  const reported =
    TIME_UPDATING.has(raw.statusCode) && raw.statusTime && likelyAirborne(raw, now)
      ? osloTime(raw.statusTime)
      : "";
  // Blank unless Avinor actually moved the time — the board leaves ETA/ETD
  // empty rather than repeating the schedule back at the reader.
  const estimated = reported && reported !== scheduled ? reported : "";

  return {
    id: raw.uniqueId || `${raw.flightId}-${raw.scheduleTime}`,
    flightId: raw.flightId,
    airline: raw.airline,
    airlineName: airlines.get(raw.airline) ?? raw.airline,
    airportCode: raw.airport,
    airportName: airports.get(raw.airport) ?? raw.airport,
    scheduleTime: raw.scheduleTime,
    scheduled,
    estimated,
    timeChanged: estimated !== "",
    leftOrigin: raw.arrDep === "A" && likelyAirborne(raw, now),
    statusCode: raw.statusCode,
    statusText: statuses.get(raw.statusCode) ?? "",
    operationalStatus:
      raw.arrDep === "D"
        ? (operationalStatuses.get(operationalStatusKey(raw.flightId, raw.airport)) ?? "")
        : "",
    gate: raw.gate,
    belt: raw.belt,
    country: border.country,
    eu: border.eu,
    basis: border.basis,
  };
}

/* ------------------------------------------------------------- border check */

interface BorderCheck {
  /** Belongs on the board */
  crossing: boolean;
  country: string;
  eu: boolean;
  basis: Flight["basis"];
}

/**
 * Two independent checks decide whether a flight crosses the Schengen border, and a
 * flight is included if EITHER says so:
 *
 *   1. Avinor's own `domInt` flag — "I" = crosses the border, "S" = inside Schengen,
 *      "D" = domestic Norway. This is the airport's operational truth.
 *   2. Our own Schengen member list (lib/regions.ts) applied to the country of the
 *      other airport, looked up in the OurAirports dataset via its IATA code.
 *
 * Because check 2 treats *everything not on the member list* as outside Schengen, a
 * brand-new route to any country — inside or outside Europe — is picked up the first
 * time it appears, without touching the code. If the airport code cannot be resolved
 * at all, the flight is still included and reported as unresolved: the board would
 * rather show one flight too many than miss a border crossing.
 */
export function checkBorder(raw: RawFlight, iata: Map<string, AirportInfo> | null): BorderCheck {
  const avinorSaysCrossing = raw.domInt === "I";

  if (!iata) {
    // Airport dataset unavailable — fall back to Avinor's flag alone.
    return { crossing: avinorSaysCrossing, country: "", eu: false, basis: "avinor-flag" };
  }

  const airport = iata.get((raw.airport ?? "").toUpperCase());
  const verdict = classifyAirport(airport?.country, airport?.icao);
  const listSaysCrossing = verdict.zone === "non-schengen";

  if (verdict.unresolved) {
    // Unknown airport code: include it unless Avinor calls it domestic Norway
    // (Svalbard is the one Norwegian border crossing and it resolves fine).
    return {
      crossing: avinorSaysCrossing || raw.domInt !== "D",
      country: "",
      eu: false,
      basis: avinorSaysCrossing ? "avinor-flag" : "unresolved",
    };
  }

  return {
    crossing: avinorSaysCrossing || listSaysCrossing,
    country: verdict.country,
    eu: verdict.eu,
    basis: avinorSaysCrossing ? "avinor-flag" : "country-list",
  };
}

/* ---------------------------------------------------------- coverage report */

const isCrossingByList = (border: BorderCheck): boolean =>
  classifyAirport(border.country).zone === "non-schengen";

interface Tally {
  inWindow: number;
  included: number;
  countryResolved: number;
  byAvinorFlag: { I: number; S: number; D: number; other: number };
  addedByCountryList: Coverage["addedByCountryList"];
  flagDisagreements: Coverage["flagDisagreements"];
  unresolved: Set<string>;
  countries: Map<string, { eu: boolean; flights: number }>;
  countryCheckSkipped: boolean;
}

const emptyTally = (countryCheckSkipped: boolean): Tally => ({
  inWindow: 0,
  included: 0,
  countryResolved: 0,
  byAvinorFlag: { I: 0, S: 0, D: 0, other: 0 },
  addedByCountryList: [],
  flagDisagreements: [],
  unresolved: new Set(),
  countries: new Map(),
  countryCheckSkipped,
});

const toCoverage = (t: Tally): Coverage => ({
  inWindow: t.inWindow,
  byAvinorFlag: t.byAvinorFlag,
  included: t.included,
  countryResolved: t.countryResolved,
  addedByCountryList: t.addedByCountryList,
  flagDisagreements: t.flagDisagreements,
  unresolved: [...t.unresolved].sort(),
  countries: [...t.countries.entries()]
    .map(([code, v]) => ({ code, eu: v.eu, flights: v.flights }))
    .sort((a, b) => b.flights - a.flights || a.code.localeCompare(b.code)),
  countryCheckSkipped: t.countryCheckSkipped,
  reference: {
    reviewed: REGION_REFERENCE.reviewed,
    schengenCountries:
      REGION_REFERENCE.schengenMembers.length + REGION_REFERENCE.schengenDeFacto.length,
    euCountries: REGION_REFERENCE.euMembers.length,
    rule: REGION_REFERENCE.rule,
  },
});

/** The reference lists themselves, so they can be inspected without reading code. */
flightsRouter.get("/regions", (c) => c.json({ data: REGION_REFERENCE }));

/**
 * Board fetch/parse/cross-check is expensive (two Avinor feed calls plus
 * lookups) and Avinor itself is a shared public resource — this cache means
 * however many people have the board open, Avinor gets hit at most once per
 * BOARD_CACHE_MS per requested date, not once per request. See lib/cache.ts.
 */
const BOARD_CACHE_MS = 60_000;

async function buildBoard(date: string): Promise<FlightBoard> {
  const start = osloStartOfDay(date);
  const end = new Date(start.getTime() + DAY_MS);
  const now = Date.now();

  const hoursBack = Math.min(
    MAX_HOURS_BACK,
    Math.max(0, Math.ceil((now - start.getTime()) / HOUR_MS) + 1)
  );
  const hoursForward = Math.min(
    MAX_HOURS_FORWARD,
    Math.max(1, Math.ceil((end.getTime() - now) / HOUR_MS) + 1)
  );

  let notice: string | null = null;
  if (now - end.getTime() > MAX_HOURS_BACK * HOUR_MS) {
    notice = "Avinor publiserer bare de siste 48 timene med flyhistorikk.";
  } else if (start.getTime() - now > MAX_HOURS_FORWARD * HOUR_MS) {
    notice = "Avinor har ikke publisert ruteplanen så langt fram ennå.";
  }

  try {
    const [arrFeed, depFeed, airports, airlines, statuses, operationalStatuses, iata] =
      await Promise.all([
        fetchFeed("A", hoursBack, hoursForward),
        fetchFeed("D", hoursBack, hoursForward),
        airportNames(),
        airlineNames(),
        statusTexts(),
        departureOperationalStatuses(date),
        // The country cross-check must never take the board down with it.
        iataIndex().catch((err) => {
          console.error("Airport/country dataset unavailable, using Avinor flag only:", err);
          return null;
        }),
    ]);

    const tally = emptyTally(iata === null);

    /**
     * Everything crossing the Schengen border — see checkBorder() for the two
     * independent tests and why unknown airports are kept rather than dropped.
     */
    const select = (flights: RawFlight[]) => {
      const out: Flight[] = [];
      for (const f of flights) {
        const t = new Date(f.scheduleTime).getTime();
        if (t < start.getTime() || t >= end.getTime()) continue;

        tally.inWindow += 1;
        const flag = f.domInt as "I" | "S" | "D";
        if (flag === "I" || flag === "S" || flag === "D") tally.byAvinorFlag[flag] += 1;
        else tally.byAvinorFlag.other += 1;

        const border = checkBorder(f, iata);
        if (border.country) tally.countryResolved += 1;
        else if (iata) tally.unresolved.add((f.airport ?? "?").toUpperCase());

        // Avinor flagged it Schengen-internal, our member list disagrees → include + report.
        if (border.basis === "country-list" && border.crossing) {
          tally.addedByCountryList.push({
            flightId: f.flightId,
            airportCode: f.airport,
            country: border.country,
            avinorFlag: f.domInt,
          });
        }
        // Avinor flagged it as a border crossing, our list says it is inside Schengen.
        // Kept on the board (Avinor knows the operation) but surfaced for review.
        if (f.domInt === "I" && border.country && !isCrossingByList(border)) {
          tally.flagDisagreements.push({
            flightId: f.flightId,
            airportCode: f.airport,
            country: border.country,
          });
        }

        if (!border.crossing) continue;
        if (border.country) {
          const seen = tally.countries.get(border.country) ?? { eu: border.eu, flights: 0 };
          seen.flights += 1;
          tally.countries.set(border.country, seen);
        }
        out.push(toFlight(f, airports, airlines, statuses, operationalStatuses, border, now));
      }
      tally.included += out.length;
      return out.sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime));
    };

    const arrivals = select(arrFeed.flights);
    const departures = select(depFeed.flights);

    const board: FlightBoard = {
      date,
      airport: "BGO",
      airportName: "Bergen Airport Flesland",
      arrivals,
      departures,
      lastUpdate: arrFeed.lastUpdate,
      notice,
      coverage: toCoverage(tally),
    };

    if (tally.addedByCountryList.length || tally.unresolved.size) {
      console.log(
        `[border-check] ${date}: ${tally.addedByCountryList.length} flight(s) added by country list, ` +
          `${tally.unresolved.size} unresolved airport code(s): ${[...tally.unresolved].join(", ")}`
      );
    }

    return board;
  } catch (err) {
    console.error("Failed to load Avinor flight data:", err);
    throw err;
  }
}

flightsRouter.get("/", async (c) => {
  const parsed = querySchema.safeParse({ date: c.req.query("date") ?? undefined });
  if (!parsed.success) {
    return c.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid query", code: "INVALID_QUERY" } },
      400
    );
  }

  const date = parsed.data.date ?? osloToday();

  try {
    const board = await cached(`board:${date}`, BOARD_CACHE_MS, () => buildBoard(date));
    return c.json({ data: board });
  } catch (err) {
    return c.json(
      { error: { message: "Får ikke kontakt med Avinors flydata akkurat nå.", code: "UPSTREAM" } },
      502
    );
  }
});

export { flightsRouter };
