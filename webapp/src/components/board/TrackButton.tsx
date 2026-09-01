import { Radar } from "lucide-react";
import { flightRadarUrl, type Flight } from "@/lib/flights";

/**
 * Opens the flight on Flightradar24 in a new tab. Flightradar24 refuses to be
 * embedded, so a new window is the only way to show the live map.
 */
export function TrackButton({ flight }: { flight: Flight }) {
  return (
    <a
      href={flightRadarUrl(flight)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Spor ${flight.flightId} på Flightradar24`}
      aria-label={`Spor ${flight.flightId} på Flightradar24`}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] text-flap-amber transition-colors hover:bg-flap-amber/15 hover:text-flap-amber sm:h-5 sm:w-5"
    >
      <Radar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
    </a>
  );
}
