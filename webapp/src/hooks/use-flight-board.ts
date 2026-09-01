import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { todayInOslo, type FlightBoard } from "@/lib/flights";

/**
 * Loads the Schengen board for one date. Today's board refreshes on its own
 * every 60s so status changes appear without a reload.
 */
export function useFlightBoard(date: string) {
  const isToday = date === todayInOslo();

  return useQuery<FlightBoard>({
    queryKey: ["flights", date],
    queryFn: () => api.get<FlightBoard>(`/api/flights?date=${date}`),
    refetchInterval: isToday ? 60_000 : false,
    staleTime: isToday ? 30_000 : 5 * 60_000,
    placeholderData: (previous) => previous,
  });
}
