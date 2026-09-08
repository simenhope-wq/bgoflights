/** Current conditions at BGO — mirrors WeatherSchema in backend/src/types.ts. */
export interface Weather {
  tempC: number;
  windMs: number;
  symbol: string;
  updatedAt: string;
}

/**
 * MET Norway's symbol codes carry a _day/_night/_polartwilight suffix for
 * variants of the same condition (e.g. "clearsky_day" vs "clearsky_night") —
 * strip that off before matching, since the tiny header icon doesn't need to
 * distinguish them.
 */
function baseSymbol(symbol: string): string {
  return symbol.replace(/_(day|night|polartwilight)$/, "");
}

const EMOJI_BY_PREFIX: [prefix: string, emoji: string][] = [
  ["thunder", "⛈️"],
  ["sleet", "🌨️"],
  ["snow", "❄️"],
  ["rain", "🌧️"],
  ["fog", "🌫️"],
  ["clearsky", "☀️"],
  ["fair", "🌤️"],
  ["partlycloudy", "⛅"],
  ["cloudy", "☁️"],
];

/** A single emoji standing in for a full icon set — this is a tiny header badge, not a forecast panel. */
export function weatherEmoji(symbol: string): string {
  const base = baseSymbol(symbol);
  return EMOJI_BY_PREFIX.find(([prefix]) => base.startsWith(prefix))?.[1] ?? "🌡️";
}
