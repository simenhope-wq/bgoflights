import { useWeather } from "@/hooks/use-weather";
import { weatherEmoji } from "@/lib/weather";

/**
 * Tiny icon + numbers next to the page title — current temperature and wind
 * at BGO, nothing more. Renders nothing while loading or on error, rather
 * than a placeholder or an error message: this is a small extra, not
 * something worth taking up space complaining about.
 */
export function WeatherBadge() {
  const { data } = useWeather();
  if (!data) return null;

  return (
    <span
      className="hidden items-baseline gap-1 whitespace-nowrap font-signage text-[11px] uppercase tracking-[0.1em] text-muted-foreground sm:inline-flex sm:text-xs"
      title={`Vær ved Flesland: ${data.tempC}°C, vind ${data.windMs} m/s`}
    >
      <span aria-hidden="true">{weatherEmoji(data.symbol)}</span>
      {data.tempC}°C · {data.windMs} m/s
    </span>
  );
}
