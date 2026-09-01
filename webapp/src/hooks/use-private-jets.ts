import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { todayInOslo, type PrivateJetBoard } from "@/lib/flights";

/**
 * Private / non-scheduled jets for one date, tracked from ADS-B — the movements
 * Avinor never publishes.
 */
export function usePrivateJets(date: string) {
  const isToday = date === todayInOslo();

  return useQuery<PrivateJetBoard>({
    queryKey: ["private-jets", date],
    queryFn: () => api.get<PrivateJetBoard>(`/api/private-jets?date=${date}`),
    refetchInterval: isToday ? 120_000 : false,
    staleTime: isToday ? 60_000 : 5 * 60_000,
    placeholderData: (previous) => previous,
  });
}
