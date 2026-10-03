import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isLowTrafficWindow, todayInOslo, type FlightBoard } from "@/lib/flights";

const NORMAL_POLL_MS = 60_000;
/**
 * 02:00–05:00 Oslo time: back off to this instead of stopping outright, so a
 * diverted or ambulance flight in the small hours still shows up within a
 * few minutes rather than being missed until the window ends (see
 * isLowTrafficWindow). Cuts the actual Avinor fetch/parse frequency in that
 * window to roughly a tenth of normal.
 */
const LOW_TRAFFIC_POLL_MS = 10 * 60_000;

/**
 * Loads the Schengen board for one date. Today's board refreshes on its own
 * every 60s so status changes appear without a reload — except during the
 * overnight lull, when it backs off to every 10 minutes instead.
 */
export function useFlightBoard(date: string) {
  const isToday = date === todayInOslo();

  return useQuery<FlightBoard>({
    queryKey: ["flights", date],
    queryFn: () => api.get<FlightBoard>(`/api/flights?date=${date}`),
    refetchInterval: isToday
      ? () => (isLowTrafficWindow() ? LOW_TRAFFIC_POLL_MS : NORMAL_POLL_MS)
      : false,
    staleTime: isToday ? 30_000 : 5 * 60_000,
    placeholderData: (previous) => previous,
  });
}
