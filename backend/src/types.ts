import { z } from "zod";

/** A single Schengen-border-crossing flight at Bergen Airport Flesland (BGO). */
export const FlightSchema = z.object({
  id: z.string(),
  /** e.g. "SK2862" */
  flightId: z.string(),
  /** IATA airline code, e.g. "SK" */
  airline: z.string(),
  /** Resolved airline name, e.g. "SAS" */
  airlineName: z.string(),
  /** IATA code of the other airport (origin for arrivals, destination for departures) */
  airportCode: z.string(),
  /** Resolved city/airport name, e.g. "Copenhagen" */
  airportName: z.string(),
  /** Scheduled time, ISO instant */
  scheduleTime: z.string(),
  /** Scheduled time formatted in Europe/Oslo, "HH:mm" */
  scheduled: z.string(),
  /** Best known time (new time / actual) in Europe/Oslo, "HH:mm" — equals `scheduled` when no update */
  estimated: z.string(),
  /** True when the airline has published a time different from schedule */
  timeChanged: z.boolean(),
  /**
   * Arrivals only: the aircraft has left its origin and is on its way to Bergen.
   * Always false for departures — see likelyAirborne() for how it is decided.
   */
  leftOrigin: z.boolean(),
  /** Avinor status code: N, E, D, A, C — empty when none */
  statusCode: z.string(),
  /** Human readable XML-feed status, e.g. "Ny tid", "Landet", "Innstilt" */
  statusText: z.string(),
  /** Passenger-facing gate stage from Avinor's live board; empty when Avinor shows none */
  operationalStatus: z.string(),
  gate: z.string(),
  belt: z.string(),
  /** ISO country of the other airport, e.g. "GB" — "" when it could not be resolved */
  country: z.string(),
  /** True when that country is an EU member state (customs, not passport control) */
  eu: z.boolean(),
  /**
   * Why the flight is on the board: Avinor's own "I" flag, or our Schengen list
   * catching a flight Avinor flagged differently.
   */
  basis: z.enum(["avinor-flag", "country-list", "unresolved"]),
});

export type Flight = z.infer<typeof FlightSchema>;

/**
 * Self-check attached to every board: what came out of the feed, what was included
 * and why, and anything the country lookup could not resolve. This is how you can
 * confirm no border-crossing flight was silently dropped.
 */
export const CoverageSchema = z.object({
  /** Flights Avinor published for BGO inside the requested day */
  inWindow: z.number(),
  /** Counts of Avinor's own domestic/international flag */
  byAvinorFlag: z.object({
    I: z.number(),
    S: z.number(),
    D: z.number(),
    other: z.number(),
  }),
  /** Flights on the board */
  included: z.number(),
  /** How many of the day's flights got a country resolved from the airport dataset */
  countryResolved: z.number(),
  /** Flights Avinor did NOT flag "I" but our Schengen list says cross the border */
  addedByCountryList: z.array(
    z.object({
      flightId: z.string(),
      airportCode: z.string(),
      country: z.string(),
      avinorFlag: z.string(),
    })
  ),
  /** Flights Avinor flagged "I" but whose country is inside Schengen — kept, flagged for review */
  flagDisagreements: z.array(
    z.object({ flightId: z.string(), airportCode: z.string(), country: z.string() })
  ),
  /** Airport codes with no country in the dataset — included as a precaution */
  unresolved: z.array(z.string()),
  /** Distinct non-Schengen countries on the board */
  countries: z.array(z.object({ code: z.string(), eu: z.boolean(), flights: z.number() })),
  /** True when the airport dataset was unreachable and only Avinor's flag was used */
  countryCheckSkipped: z.boolean(),
  reference: z.object({
    reviewed: z.string(),
    schengenCountries: z.number(),
    euCountries: z.number(),
    rule: z.string(),
  }),
});

export type Coverage = z.infer<typeof CoverageSchema>;

export const FlightBoardSchema = z.object({
  /** Requested date, YYYY-MM-DD (Europe/Oslo) */
  date: z.string(),
  airport: z.string(),
  airportName: z.string(),
  arrivals: z.array(FlightSchema),
  departures: z.array(FlightSchema),
  /** When Avinor last refreshed the feed, ISO instant */
  lastUpdate: z.string(),
  /** Set when the requested date lies outside the range Avinor publishes */
  notice: z.string().nullable(),
  /** Border-check self-report, see CoverageSchema */
  coverage: CoverageSchema,
});

export type FlightBoard = z.infer<typeof FlightBoardSchema>;

/**
 * A private / non-scheduled jet movement at BGO, seen on ADS-B (OpenSky) rather
 * than in Avinor's schedule. Same Schengen-border rule as the main board.
 */
export const PrivateJetSchema = z.object({
  id: z.string(),
  /** "arrival" (landed at BGO) or "departure" (left BGO) */
  kind: z.enum(["arrival", "departure"]),
  /** Callsign, usually the aircraft registration, e.g. "LNAWA" */
  callsign: z.string(),
  /** Time at BGO in Europe/Oslo, "HH:mm" */
  time: z.string(),
  /** Same moment as an ISO instant, used for sorting */
  timeIso: z.string(),
  /** The other airport */
  airportCode: z.string(),
  airportName: z.string(),
  /** ISO country of the other airport, e.g. "GB" — "" when ADS-B did not resolve it */
  country: z.string(),
  /**
   * True when ADS-B could not tell where the aircraft came from / went to. Such
   * movements are shown rather than hidden, since one of them may be a border
   * crossing — but the route is marked unknown instead of guessed.
   */
  unknownRoute: z.boolean(),
});

export type PrivateJet = z.infer<typeof PrivateJetSchema>;

export const PrivateJetBoardSchema = z.object({
  date: z.string(),
  movements: z.array(PrivateJetSchema),
  /** Non-scheduled movements seen at BGO, before the Schengen filter */
  checked: z.number(),
  /** Of those, how many had no resolvable other airport */
  unknownRoutes: z.number(),
  /** False when ADS-B history for this date is not reachable (no OpenSky account) */
  available: z.boolean(),
  notice: z.string().nullable(),
});

export type PrivateJetBoard = z.infer<typeof PrivateJetBoardSchema>;
