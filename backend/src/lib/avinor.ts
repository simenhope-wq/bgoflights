/**
 * Client for Avinor's public flight data feed (https://avinor.no/en/corporate/services/flydata/).
 * Feeds are XML encoded as ISO-8859-1 and are parsed here without extra dependencies.
 */

const FEED = "https://asrv.avinor.no/XmlFeed/v1.0";
const AIRPORT_NAMES = "https://asrv.avinor.no/airportNames/v1.0";
const AIRLINE_NAMES = "https://asrv.avinor.no/airlineNames/v1.0";
const STATUSES = "https://asrv.avinor.no/flightStatuses/v1.0";
const WEBSITE_DEPARTURES = "https://www.avinor.no/api/v1/flights/departure/BGO";

export const OSLO_TZ = "Europe/Oslo";

async function fetchLatin1(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "flesland-schengen-board/1.0" } });
  if (!res.ok) throw new Error(`Avinor request failed (${res.status}) for ${url}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("latin1");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Pulls the text of a child element, e.g. <airline>SK</airline>. */
function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m?.[1] ? decodeEntities(m[1].trim()) : "";
}

/** Pulls an attribute of a self-closing child, e.g. <status code="E" time="..."/>. */
function attr(xml: string, element: string, name: string): string {
  const el = xml.match(new RegExp(`<${element}\\b[^>]*/?>`));
  if (!el) return "";
  const m = el[0].match(new RegExp(`${name}="([^"]*)"`));
  return m?.[1] ? decodeEntities(m[1]) : "";
}

export interface RawFlight {
  uniqueId: string;
  airline: string;
  flightId: string;
  domInt: string;
  scheduleTime: string;
  arrDep: "A" | "D";
  airport: string;
  statusCode: string;
  statusTime: string;
  gate: string;
  belt: string;
}

export interface RawFeed {
  flights: RawFlight[];
  lastUpdate: string;
}

/**
 * @param direction "A" arrivals, "D" departures
 * @param hoursBack whole hours of history to include (Avinor allows up to 48)
 * @param hoursForward whole hours into the future to include
 */
export async function fetchFeed(
  direction: "A" | "D",
  hoursBack: number,
  hoursForward: number
): Promise<RawFeed> {
  const url = `${FEED}?airport=BGO&direction=${direction}&TimeFrom=${hoursBack}&TimeTo=${hoursForward}`;
  const xml = await fetchLatin1(url);
  const lastUpdate = attr(xml, "flights", "lastUpdate") || new Date().toISOString();

  const flights: RawFlight[] = [];
  for (const block of xml.match(/<flight\b[\s\S]*?<\/flight>/g) ?? []) {
    flights.push({
      uniqueId: attr(block, "flight", "uniqueID"),
      airline: tag(block, "airline"),
      flightId: tag(block, "flight_id"),
      domInt: tag(block, "dom_int"),
      scheduleTime: tag(block, "schedule_time"),
      arrDep: (tag(block, "arr_dep") || direction) as "A" | "D",
      airport: tag(block, "airport"),
      statusCode: attr(block, "status", "code"),
      statusTime: attr(block, "status", "time"),
      gate: tag(block, "gate"),
      belt: tag(block, "belt"),
    });
  }
  return { flights, lastUpdate };
}

/** Static lookup tables change rarely — cached in memory for a day. */
interface Cached {
  value: Map<string, string>;
  expires: number;
}
const caches = new Map<string, Cached>();
const DAY_MS = 24 * 60 * 60 * 1000;

async function lookupTable(
  key: string,
  url: string,
  element: string
): Promise<Map<string, string>> {
  const hit = caches.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const map = new Map<string, string>();
  try {
    const xml = await fetchLatin1(url);
    for (const el of xml.match(new RegExp(`<${element}\\b[^>]*/>`, "g")) ?? []) {
      const code = el.match(/code="([^"]*)"/)?.[1];
      const name = el.match(/name="([^"]*)"/)?.[1];
      if (code && name) map.set(code, decodeEntities(name));
    }
    caches.set(key, { value: map, expires: Date.now() + DAY_MS });
  } catch (err) {
    console.error(`Failed to load ${key} lookup:`, err);
    if (hit) return hit.value;
  }
  return map;
}

export const airportNames = () => lookupTable("airports", AIRPORT_NAMES, "airportName");
export const airlineNames = () => lookupTable("airlines", AIRLINE_NAMES, "airlineName");

export async function statusTexts(): Promise<Map<string, string>> {
  const hit = caches.get("statuses");
  if (hit && hit.expires > Date.now()) return hit.value;

  const map = new Map<string, string>();
  try {
    const xml = await fetchLatin1(STATUSES);
    for (const el of xml.match(/<flightStatus\b[^>]*\/>/g) ?? []) {
      const code = el.match(/code="([^"]*)"/)?.[1];
      const text = el.match(/statusTextNo="([^"]*)"/)?.[1];
      if (code && text) map.set(code, decodeEntities(text));
    }
    caches.set("statuses", { value: map, expires: Date.now() + DAY_MS });
  } catch (err) {
    console.error("Failed to load status lookup:", err);
  }
  return map;
}

interface WebsiteFlightLeg {
  flightIds?: { flightId?: string }[];
  arrival?: { airportIata?: string };
  departure?: {
    statusCode?: string | null;
    gate?: { statusDescription?: string | null };
  };
}

interface OperationalStatusCache {
  value: Map<string, string>;
  expires: number;
}

const operationalStatusCaches = new Map<string, OperationalStatusCache>();
const OPERATIONAL_STATUS_TTL_MS = 30 * 1000;
// Gate stages are optional enrichment. Never let this secondary endpoint hold up
// the main flight board when Avinor's website API is slow or unavailable.
const OPERATIONAL_STATUS_TIMEOUT_MS = 3 * 1000;

export function operationalStatusKey(flightId: string, airport: string): string {
  return `${flightId.replace(/\s+/g, "").toUpperCase()}|${airport.toUpperCase()}`;
}

/**
 * Avinor's website API carries the passenger-facing gate stages that are absent
 * from the older XML feed: Go to gate, Boarding, Gate closing, and Gate closed.
 */
export async function departureOperationalStatuses(date: string): Promise<Map<string, string>> {
  const hit = operationalStatusCaches.get(date);
  if (hit && hit.expires > Date.now()) return hit.value;

  try {
    const response = await fetch(`${WEBSITE_DEPARTURES}?dateTime=${encodeURIComponent(date)}`, {
      headers: { "User-Agent": "flesland-schengen-board/1.0" },
      signal: AbortSignal.timeout(OPERATIONAL_STATUS_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Avinor website request failed (${response.status})`);

    const payload = (await response.json()) as { flightLegs?: WebsiteFlightLeg[] };
    const map = new Map<string, string>();
    for (const leg of payload.flightLegs ?? []) {
      const departureStatus = leg.departure?.statusCode;
      const gateStatus = leg.departure?.gate?.statusDescription?.trim();
      const destination = leg.arrival?.airportIata;

      // Avinor's own board replaces the gate stage with Cancelled or Departed.
      if (!gateStatus || !destination || departureStatus === "C" || departureStatus === "D") continue;
      for (const flight of leg.flightIds ?? []) {
        if (flight.flightId) map.set(operationalStatusKey(flight.flightId, destination), gateStatus);
      }
    }

    operationalStatusCaches.set(date, {
      value: map,
      expires: Date.now() + OPERATIONAL_STATUS_TTL_MS,
    });
    return map;
  } catch (err) {
    console.error("Failed to load Avinor operational statuses:", err);
    return hit?.value ?? new Map<string, string>();
  }
}

/** Milliseconds Europe/Oslo is ahead of UTC at the given instant. */
function osloOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OSLO_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return asUtc - instant.getTime();
}

/** UTC instant of 00:00 Europe/Oslo on the given YYYY-MM-DD. */
export function osloStartOfDay(date: string): Date {
  const guess = new Date(`${date}T00:00:00Z`);
  const adjusted = new Date(guess.getTime() - osloOffsetMs(guess));
  // Re-check in case the first guess landed on the other side of a DST switch.
  return new Date(guess.getTime() - osloOffsetMs(adjusted));
}

/** Today's date in Europe/Oslo as YYYY-MM-DD. */
export function osloToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: OSLO_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "HH:mm" in Europe/Oslo. */
export function osloTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return timeFormatter.format(d);
}
