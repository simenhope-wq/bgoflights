/**
 * Schengen / EU reference data — the single place the whole app decides whether a
 * flight crosses the Schengen border.
 *
 * The board must never miss a border-crossing flight just because a route is new.
 * Therefore the rule is a *deny list of insiders*, not an allow list of outsiders:
 * a country counts as border-crossing unless it is explicitly listed as a Schengen
 * member below. Any new destination — Skopje, Tirana, Doha, Newark — is included
 * automatically the first time it shows up in the feed, with no code change.
 *
 * Last reviewed: 2026-08 (Bulgaria + Romania fully inside since 2024-03/2025-01).
 */

/** ISO 3166-1 alpha-2 codes of full Schengen members. */
const SCHENGEN_MEMBERS = [
  "AT", // Austria
  "BE", // Belgium
  "BG", // Bulgaria — air/sea 2024-03-31, land 2025-01-01
  "CH", // Switzerland
  "CZ", // Czechia
  "DE", // Germany
  "DK", // Denmark (mainland only — see NON_SCHENGEN_TERRITORY_ICAO / GL, FO)
  "EE", // Estonia
  "ES", // Spain
  "FI", // Finland
  "FR", // France (metropolitan only — overseas départements are outside)
  "GR", // Greece
  "HR", // Croatia
  "HU", // Hungary
  "IS", // Iceland
  "IT", // Italy
  "LI", // Liechtenstein
  "LT", // Lithuania
  "LU", // Luxembourg
  "LV", // Latvia
  "MT", // Malta
  "NL", // Netherlands (European part only — Caribbean parts are outside)
  "NO", // Norway (mainland only — Svalbard is outside)
  "PL", // Poland
  "PT", // Portugal (incl. Azores + Madeira)
  "RO", // Romania — air/sea 2024-03-31, land 2025-01-01
  "SE", // Sweden
  "SI", // Slovenia
  "SK", // Slovakia
] as const;

/**
 * De-facto inside the area: no border control with their neighbours, open borders
 * by treaty. Included so a bizjet from Monaco or San Marino is not flagged.
 */
const SCHENGEN_DE_FACTO = ["MC", "SM", "VA"] as const;

/** The 27 EU member states. Used for the customs/EU note, not for passport control. */
const EU_MEMBERS = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR",
  "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;

const SCHENGEN = new Set<string>([...SCHENGEN_MEMBERS, ...SCHENGEN_DE_FACTO]);
const EU = new Set<string>(EU_MEMBERS);

/**
 * Territories that share their parent country's ISO code in the airport dataset but
 * sit *outside* Schengen, so passport control applies. Greenland (GL), the Faroes
 * (FO), the French overseas départements (GP, MQ, GF, RE, YT …) and the Dutch
 * Caribbean (AW, CW, SX, BQ) already carry their own ISO codes and are handled by
 * the list above; Svalbard does not — the dataset files it under "NO".
 */
const NON_SCHENGEN_TERRITORY_ICAO: Record<string, string> = {
  ENSB: "Svalbard (Longyearbyen)",
  ENAS: "Svalbard (Ny-Ålesund)",
  ENSA: "Svalbard (Svea)",
};

/** Schengen for passport purposes, but outside the EU customs/VAT territory. */
const OUTSIDE_EU_CUSTOMS_ICAO_PREFIX = ["GC", "GE"]; // Canary Islands, Ceuta/Melilla

export type Zone = "schengen" | "non-schengen";

export interface ZoneVerdict {
  zone: Zone;
  /** ISO country as resolved, "" when unknown */
  country: string;
  /** Country is an EU member state */
  eu: boolean;
  /** How the verdict was reached — shown in the coverage report */
  basis: "member-list" | "territory-override" | "unknown-country";
  /** True when the country could not be resolved; such flights are included, never dropped */
  unresolved: boolean;
}

/** True only for countries explicitly listed as Schengen members above. */
export const isSchengenCountry = (country: string): boolean =>
  SCHENGEN.has((country ?? "").trim().toUpperCase());

export const isEuCountry = (country: string): boolean =>
  EU.has((country ?? "").trim().toUpperCase());

/**
 * Classify the other end of a flight. `icao` is optional and only used to catch the
 * territory exceptions. Unknown countries deliberately fall out as "non-schengen":
 * better to show one flight too many than to hide a border crossing.
 */
export function classifyAirport(country: string | undefined, icao?: string): ZoneVerdict {
  const code = (icao ?? "").trim().toUpperCase();
  const iso = (country ?? "").trim().toUpperCase();

  if (code && NON_SCHENGEN_TERRITORY_ICAO[code]) {
    return { zone: "non-schengen", country: iso, eu: false, basis: "territory-override", unresolved: false };
  }
  if (!iso) {
    return { zone: "non-schengen", country: "", eu: false, basis: "unknown-country", unresolved: true };
  }
  return {
    zone: isSchengenCountry(iso) ? "schengen" : "non-schengen",
    country: iso,
    eu: isEuCountry(iso),
    basis: "member-list",
    unresolved: false,
  };
}

/** Outside the EU customs union even though inside Schengen (Canaries, Ceuta, Melilla). */
export const isOutsideEuCustoms = (icao?: string): boolean =>
  OUTSIDE_EU_CUSTOMS_ICAO_PREFIX.some((p) => (icao ?? "").toUpperCase().startsWith(p));

/** Snapshot of the reference data, exposed on the coverage endpoint. */
export const REGION_REFERENCE = {
  reviewed: "2026-08",
  schengenMembers: [...SCHENGEN_MEMBERS],
  schengenDeFacto: [...SCHENGEN_DE_FACTO],
  euMembers: [...EU_MEMBERS],
  territoryOverrides: NON_SCHENGEN_TERRITORY_ICAO,
  rule: "Alt som ikke står på Schengen-listen regnes som utenfor Schengen.",
};
