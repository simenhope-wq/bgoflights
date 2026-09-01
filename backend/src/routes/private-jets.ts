import { Hono } from "hono";
import { z } from "zod";
import { osloStartOfDay, osloTime, osloToday } from "../lib/avinor";
import {
  BGO_ICAO,
  airportFlights,
  airportIndex,
  hasOpenSkyCredentials,
  isNonScheduled,
  type OpenSkyFlight,
} from "../lib/opensky";
import { classifyAirport } from "../lib/regions";
import type { PrivateJet, PrivateJetBoard } from "../types";
import { cached } from "../lib/cache";
import { requireAuth } from "../middleware/require-auth";

const privateJetsRouter = new Hono();
privateJetsRouter.use("*", requireAuth);

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * OpenSky only serves flight history to signed-in clients, so the box stays switched
 * off until a (free) account is configured.
 */
const NO_ACCOUNT_NOTICE =
  "Privatfly spores via direkte ADS-B. Legg inn en gratis OpenSky Network-nøkkel i ENV-fanen som OPENSKY_CLIENT_ID og OPENSKY_CLIENT_SECRET for å slå det på.";

/**
 * Same reasoning as the main board (see BOARD_CACHE_MS in routes/flights.ts):
 * OpenSky is a shared, rate-limited resource, so cache per date rather than
 * calling it once per visitor.
 */
const JET_CACHE_MS = 60_000;

async function buildJetBoard(date: string): Promise<PrivateJetBoard> {
  const start = osloStartOfDay(date);
  const end = new Date(start.getTime() + DAY_MS);
  const now = Date.now();

  const from = start.getTime();
  const to = Math.min(end.getTime(), now);

  if (!hasOpenSkyCredentials()) {
    const board: PrivateJetBoard = {
      date,
      movements: [],
      checked: 0,
      unknownRoutes: 0,
      available: false,
      notice: NO_ACCOUNT_NOTICE,
    };
    return board;
  }

  if (to <= from) {
    const board: PrivateJetBoard = {
      date,
      movements: [],
      checked: 0,
      unknownRoutes: 0,
      available: true,
      notice: start.getTime() > now ? "Privatfly vises først etter at de har flydd." : null,
    };
    return board;
  }

  try {
    const [arrivals, departures, airports] = await Promise.all([
      airportFlights("arrival", BGO_ICAO, from / 1000, to / 1000),
      airportFlights("departure", BGO_ICAO, from / 1000, to / 1000),
      airportIndex(),
    ]);

    const movements: PrivateJet[] = [];
    const seen = new Set<string>();
    let checked = 0;
    let unknownRoutes = 0;

    const collect = (flights: OpenSkyFlight[], kind: "arrival" | "departure") => {
      for (const f of flights) {
        if (!isNonScheduled(f.callsign)) continue;
        checked += 1;

        const otherIcao = (
          kind === "arrival" ? f.estDepartureAirport : f.estArrivalAirport
        )?.toUpperCase();
        if (otherIcao === BGO_ICAO) continue;

        /**
         * OpenSky often has no other end for a movement (its receivers only cover part
         * of the route). Rather than drop it — it could be the bizjet from Aberdeen —
         * the movement is kept and marked as an unknown route.
         */
        if (!otherIcao) {
          unknownRoutes += 1;
          const stamp = (kind === "arrival" ? f.lastSeen : f.firstSeen) * 1000;
          if (stamp < start.getTime() || stamp >= end.getTime()) continue;
          const id = `${kind}-${f.icao24}-${Math.round(stamp / 60000)}`;
          if (seen.has(id)) continue;
          seen.add(id);
          movements.push({
            id,
            kind,
            callsign: (f.callsign ?? "").trim().toUpperCase(),
            time: osloTime(new Date(stamp).toISOString()),
            timeIso: new Date(stamp).toISOString(),
            airportCode: "",
            airportName: "Ukjent rute",
            country: "",
            unknownRoute: true,
          });
          continue;
        }

        const airport = airports.get(otherIcao);
        /**
         * Same shared list as the main board (lib/regions.ts): anything not on the
         * Schengen member list crosses the border, so new countries need no code
         * change. An ICAO code missing from the dataset is kept — flagged with its
         * raw code — rather than silently dropped.
         */
        const verdict = classifyAirport(airport?.country, otherIcao);
        if (verdict.zone === "schengen") continue;
        if (verdict.unresolved) {
          console.log(`[border-check] unknown ADS-B airport ${otherIcao}, kept as non-Schengen`);
        }

        const stamp = (kind === "arrival" ? f.lastSeen : f.firstSeen) * 1000;
        if (stamp < start.getTime() || stamp >= end.getTime()) continue;

        const id = `${kind}-${f.icao24}-${Math.round(stamp / 60000)}`;
        if (seen.has(id)) continue;
        seen.add(id);

        movements.push({
          id,
          kind,
          callsign: (f.callsign ?? "").trim().toUpperCase(),
          time: osloTime(new Date(stamp).toISOString()),
          timeIso: new Date(stamp).toISOString(),
          airportCode: airport?.iata || otherIcao,
          airportName: airport?.name || otherIcao,
          country: verdict.country,
          unknownRoute: false,
        });
      }
    };

    collect(arrivals, "arrival");
    collect(departures, "departure");
    movements.sort((a, b) => a.timeIso.localeCompare(b.timeIso));

    const board: PrivateJetBoard = {
      date,
      movements,
      checked,
      unknownRoutes,
      available: true,
      notice: null,
    };
    return board;
  } catch (err) {
    console.error("Failed to load private jet movements:", err);
    throw err;
  }
}

privateJetsRouter.get("/", async (c) => {
  const parsed = querySchema.safeParse({ date: c.req.query("date") ?? undefined });
  if (!parsed.success) {
    return c.json(
      {
        error: {
          message: parsed.error.issues[0]?.message ?? "Invalid query",
          code: "INVALID_QUERY",
        },
      },
      400
    );
  }

  const date = parsed.data.date ?? osloToday();

  try {
    const board = await cached(`jets:${date}`, JET_CACHE_MS, () => buildJetBoard(date));
    return c.json({ data: board });
  } catch (err) {
    return c.json(
      {
        error: { message: "Får ikke kontakt med ADS-B-data akkurat nå.", code: "UPSTREAM" },
      },
      502
    );
  }
});

export { privateJetsRouter };
