import { Hono } from "hono";
import { cached } from "../lib/cache.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { Weather } from "../types.js";

const weatherRouter = new Hono();
weatherRouter.use("*", requireAuth);

// Bergen Airport, Flesland (BGO)
const BGO_LAT = 60.2934;
const BGO_LON = 5.2181;

/**
 * MET Norway's forecast only actually changes every hour or so — polling far
 * more often than that would just be hammering a free public service for
 * data that hasn't moved. This powers a tiny icon, not a live radar.
 */
const WEATHER_CACHE_MS = 15 * 60_000;

async function fetchWeather(): Promise<Weather> {
  const res = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${BGO_LAT}&lon=${BGO_LON}`,
    {
      headers: {
        // MET Norway's Terms of Service require a descriptive User-Agent
        // identifying the calling application, so they can reach the
        // operator if something's misbehaving — not a secret, just an
        // abuse-contact string. https://api.met.no/doc/TermsOfService
        "User-Agent": "BGOFlightsBoard/1.0 https://grense.xyz",
      },
    }
  );
  if (!res.ok) throw new Error(`MET Norway responded ${res.status}`);

  const json = (await res.json()) as {
    properties?: {
      timeseries?: {
        data?: {
          instant?: { details?: { air_temperature?: number; wind_speed?: number } };
          next_1_hours?: { summary?: { symbol_code?: string } };
          next_6_hours?: { summary?: { symbol_code?: string } };
        };
      }[];
    };
  };

  const first = json.properties?.timeseries?.[0];
  const details = first?.data?.instant?.details;
  if (details?.air_temperature === undefined || details?.wind_speed === undefined) {
    throw new Error("Unexpected MET Norway response shape");
  }

  const symbol =
    first?.data?.next_1_hours?.summary?.symbol_code ??
    first?.data?.next_6_hours?.summary?.symbol_code ??
    "cloudy";

  return {
    tempC: Math.round(details.air_temperature),
    windMs: Math.round(details.wind_speed),
    symbol,
    updatedAt: new Date().toISOString(),
  };
}

weatherRouter.get("/", async (c) => {
  try {
    const weather = await cached("weather:bgo", WEATHER_CACHE_MS, fetchWeather);
    return c.json({ data: weather });
  } catch (err) {
    console.error("Failed to load weather:", err);
    return c.json(
      { error: { message: "Får ikke kontakt med værdata akkurat nå.", code: "UPSTREAM" } },
      502
    );
  }
});

export { weatherRouter };
