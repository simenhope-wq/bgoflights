import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Weather } from "@/lib/weather";

/**
 * Current conditions at BGO — the backend caches this for 15 minutes (see
 * WEATHER_CACHE_MS in routes/weather.ts), so polling more often than that
 * would only be re-reading the same cached value.
 */
export function useWeather() {
  return useQuery<Weather>({
    queryKey: ["weather"],
    queryFn: () => api.get<Weather>("/api/weather"),
    refetchInterval: 15 * 60_000,
    staleTime: 10 * 60_000,
  });
}
