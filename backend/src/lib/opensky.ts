/**
 * ADS-B movements from the OpenSky Network — used for the traffic Avinor does not
 * publish: private jets and other non-scheduled flights (the ones you otherwise
 * only see on Flightradar24).
 *
 * OpenSky serves the last couple of hours anonymously; anything older needs a free
 * account (OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET, OAuth2 client credentials).
 */

const API = "https://opensky-network.org/api";
const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

/** Bergen Airport Flesland */
export const BGO_ICAO = "ENBR";

export interface OpenSkyFlight {
  icao24: string;
  callsign: string | null;
  firstSeen: number;
  lastSeen: number;
  estDepartureAirport: string | null;
  estArrivalAirport: string | null;
}

export const hasOpenSkyCredentials = (): boolean =>
  Boolean(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);

let token: { value: string; expires: number } | null = null;

async function accessToken(): Promise<string | null> {
  if (!hasOpenSkyCredentials()) return null;
  if (token && token.expires > Date.now() + 30_000) return token.value;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.OPENSKY_CLIENT_ID as string,
    client_secret: process.env.OPENSKY_CLIENT_SECRET as string,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`OpenSky login failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("OpenSky login returned no token");
  token = {
    value: json.access_token,
    expires: Date.now() + (json.expires_in ?? 1800) * 1000,
  };
  return token.value;
}

/** Arrivals or departures at an airport between two unix seconds. */
export async function airportFlights(
  kind: "arrival" | "departure",
  airport: string,
  begin: number,
  end: number
): Promise<OpenSkyFlight[]> {
  const auth = await accessToken();
  const url = `${API}/flights/${kind}?airport=${airport}&begin=${Math.floor(begin)}&end=${Math.ceil(end)}`;
  const res = await fetch(url, {
    headers: auth ? { authorization: `Bearer ${auth}` } : {},
  });
  // OpenSky answers 404 when it simply has nothing in the window.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`OpenSky ${kind}s failed (${res.status})`);
  const json = (await res.json()) as OpenSkyFlight[];
  return Array.isArray(json) ? json : [];
}

/* ------------------------------------------------------------------ airports */

export interface AirportInfo {
  icao: string;
  iata: string;
  name: string;
  country: string;
  /** OurAirports type: large_airport, medium_airport, closed … */
  type: string;
}

const AIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const CACHE_MS = 24 * 60 * 60 * 1000;

let airportCache: { at: number; map: Map<string, AirportInfo> } | null = null;

/** Split one CSV line, honouring "quoted, fields". */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(field);
      field = "";
    } else field += ch;
  }
  out.push(field);
  return out;
}

/** ICAO code → airport name, IATA code and country, from the OurAirports dataset. */
export async function airportIndex(): Promise<Map<string, AirportInfo>> {
  if (airportCache && Date.now() - airportCache.at < CACHE_MS) return airportCache.map;

  const res = await fetch(AIRPORTS_CSV);
  if (!res.ok) throw new Error(`Airport list failed (${res.status})`);
  const text = await res.text();

  const map = new Map<string, AirportInfo>();
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const cols = splitCsv(line);
    const icao = (cols[1] ?? "").toUpperCase();
    if (icao.length !== 4) continue;
    map.set(icao, {
      icao,
      iata: (cols[13] ?? "").toUpperCase(),
      name: cleanName(cols[3] ?? icao),
      country: (cols[8] ?? "").toUpperCase(),
      type: cols[2] ?? "",
    });
  }
  airportCache = { at: Date.now(), map };
  return map;
}

/** "London Gatwick Airport" → "London Gatwick" — the board has narrow columns. */
function cleanName(name: string): string {
  return name
    .replace(/\s+(International|Regional|Municipal)?\s*(Airport|Airfield|Aerodrome|Airbase|Air Base)$/i, "")
    .replace(/,\s*/g, " ")
    .trim();
}

/**
 * IATA code → airport info, for the Avinor feed (which reports IATA, not ICAO).
 * Built from the same dataset, so both boards judge countries identically.
 */
export async function iataIndex(): Promise<Map<string, AirportInfo>> {
  const byIcao = await airportIndex();
  if (iataCache && iataCache.source === byIcao) return iataCache.map;
  // A handful of IATA codes appear twice in the dataset; keep the real airport.
  const rank = (t: string) =>
    t === "large_airport" ? 3 : t === "medium_airport" ? 2 : t === "small_airport" ? 1 : 0;
  const map = new Map<string, AirportInfo>();
  for (const info of byIcao.values()) {
    if (info.iata.length !== 3) continue;
    const current = map.get(info.iata);
    if (!current || rank(info.type) > rank(current.type)) map.set(info.iata, info);
  }
  iataCache = { source: byIcao, map };
  return map;
}

let iataCache: { source: Map<string, AirportInfo>; map: Map<string, AirportInfo> } | null = null;

/* ------------------------------------------------------- private / scheduled */

/**
 * Business-jet operators that fly airline-style callsigns (NetJets, VistaJet …),
 * so they would otherwise look like a scheduled flight.
 */
const PRIVATE_OPERATORS = new Set([
  "NJE", "EJA", "LXJ", "VJT", "JME", "GAM", "DCS", "TWY", "IJM", "FJO", "XOJ", "LNX",
  "OMH", "PJS", "SVW", "EIS", "AHO", "JTL", "GSW", "MLC", "ROU", "CFA", "AVN", "TAG",
  "GLJ", "LJS", "SGR", "EXU", "JAS", "SJT", "BZJ", "AAB", "GLX", "FLY",
]);

/**
 * Airlines and operators that serve BGO on schedule. Needed because several of them
 * — Widerøe above all — use radio callsigns like "WIF6VF" that do not look like a
 * flight number, so the pattern below would otherwise read them as private jets.
 */
const SCHEDULED_OPERATORS = new Set([
  "SAS", "SZS", "NOZ", "NSZ", "NAX", "IBK", "WIF", "BLF", "KLM", "BAW", "CFE", "EZY",
  "EJU", "DLH", "CLH", "AFR", "RYR", "RUK", "FIN", "LOT", "AUA", "SWR", "TAP", "IBE",
  "VLG", "TUI", "BLX", "TFL", "NVR", "SDR", "EWG", "WZZ", "PGT", "THY", "ICE", "FDX",
  "UPS", "BCS", "GEC", "BNO", "CHC", "HKS",
]);

/** A scheduled airline callsign is three letters plus a flight number, e.g. "SAS4571". */
const AIRLINE_CALLSIGN = /^[A-Z]{3}\d{1,4}[A-Z]{0,2}$/;

/**
 * True for traffic that is not a scheduled airline flight — private and business
 * jets fly on their registration ("LNAWA", "N456QS") or a bizjet operator code.
 */
export function isNonScheduled(callsign: string | null): boolean {
  const cs = (callsign ?? "").trim().toUpperCase();
  if (cs.length < 3) return false;
  const prefix = cs.slice(0, 3);
  if (PRIVATE_OPERATORS.has(prefix)) return true;
  if (SCHEDULED_OPERATORS.has(prefix)) return false;
  return !AIRLINE_CALLSIGN.test(cs);
}
