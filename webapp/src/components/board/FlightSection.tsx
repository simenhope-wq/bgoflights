import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";
import {
  displayTime,
  flightStatus,
  hasDeparted,
  isCancelled,
  isDelayed,
  isNewTime,
  isTrackable,
  landedLongAgo,
  type CopyBlock,
  type Flight,
  type StatusTone,
} from "@/lib/flights";
import { ColumnLabel } from "./ColumnLabel";
import { SectionPlate } from "./SectionPlate";
import { SplitFlapText } from "./SplitFlapText";
import { TrackButton } from "./TrackButton";

interface FlightSectionProps {
  kind: "arrivals" | "departures";
  flights: Flight[];
  loading: boolean;
  /** Changing this re-flips the whole section (the selected date). */
  flipKey: string;
  getCopyBlocks: (shift?: "day" | "night") => CopyBlock[];
}

/** Flap counts per column — fixed, like the real hardware.
 *  `placeSm` is the phone's shorter Fra/Til field: only four columns show there,
 *  so the name gets exactly the room a phone can spare. */
const W = { time: 5, eta: 5, flight: 7, place: 24, placeSm: 16, code: 3, status: 12 } as const;

const ROW_TICKS = 3;

const TONE_CLASS: Record<StatusTone, string> = {
  ink: "text-flap-ink",
  dim: "text-flap-dim",
  amber: "text-flap-amber",
  red: "text-flap-red",
  green: "text-flap-green",
};

export function FlightSection({
  kind,
  flights,
  loading,
  flipKey,
  getCopyBlocks,
}: FlightSectionProps) {
  // Ticks every minute so a landing fades once it passes the hour mark.
  const now = useNow();
  const isArrivals = kind === "arrivals";
  const title = isArrivals ? "Ankomst" : "Avgang";
  const timeLabel = isArrivals ? "ETA" : "ETD";
  const placeLabel = isArrivals ? "Fra" : "Til";
  // The Flightradar24 slot is only worth reserving when something in this
  // section is actually in the air — otherwise Status runs flush to the edge
  // instead of leaving a dead strip of board behind it.
  const showTrack = flights.some(isTrackable);

  return (
    // Avgang and Ankomst butt straight together — their borders overlap by 1px.
    <section className="-mt-px first:mt-0">
      {/* Yellow signage plate */}
      <SectionPlate
        title={title}
        arriving={isArrivals}
        note={loading ? "· · ·" : `${flights.length} fly`}
      />

      {/* The board itself */}
      <div
        className="overflow-x-auto rounded-b-[3px] border border-board-frame px-3 pb-3 pt-2.5 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.65)]"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 0%, hsl(var(--board)) 0%, hsl(var(--board-deep)) 100%)",
        }}
      >
        <div className="text-[12px] leading-tight sm:text-[18px]">
          {/* Column labels, screen-printed on the board frame */}
          <div className="flex gap-1 pb-2 text-flap-ink sm:gap-2">
            <ColumnLabel label="Tid" width={W.time} />
            <ColumnLabel label={timeLabel} width={W.eta} />
            <ColumnLabel label="Fly" width={W.flight} />
            <span className="flex shrink-0 items-start gap-1 sm:gap-2">
              <ColumnLabel label={placeLabel} width={W.placeSm} className="sm:hidden" />
              <ColumnLabel label={placeLabel} width={W.place} className="hidden sm:inline-block" />
              <ColumnLabel label="" width={W.code} className="hidden sm:inline-block" />
            </span>
            {/* Status hugs the right edge of the board, so its outer margin
                mirrors the padding "Tid" sits behind on the left. */}
            <span className="ml-auto flex shrink-0 items-start gap-1 sm:gap-2">
              {/* Slot for the Flightradar24 link — it rides in the gap ahead of
                  Status, and is kept in the header so the columns line up
                  whether or not a row actually has one. */}
              {showTrack ? <span className="w-4 shrink-0 sm:w-5" /> : null}
              <ColumnLabel label="Status" width={W.status} className="hidden sm:inline-block" />
            </span>
          </div>

          {loading ? (
            <div className="space-y-[3px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-1 sm:gap-2">
                  <SplitFlapText value="" width={W.time} className="text-flap-dim" />
                  <SplitFlapText value="" width={W.eta} className="text-flap-dim" />
                  <SplitFlapText value="" width={W.flight} className="text-flap-dim" />
                  <SplitFlapText value="" width={W.placeSm} className="text-flap-dim sm:hidden" />
                  <SplitFlapText value="" width={W.place} className="hidden text-flap-dim sm:inline-flex" />
                </div>
              ))}
            </div>
          ) : flights.length === 0 ? (
            <div className="py-1">
              <SplitFlapText
                value="INGEN FLY DENNE DAGEN"
                width={21}
                flipKey={flipKey}
                className="text-flap-dim"
              />
            </div>
          ) : (
            <ol className="space-y-[3px]">
              {flights.map((flight, index) => {
                const cancelled = isCancelled(flight);
                const delayed = isDelayed(flight);
                // Flights that have left, or landed over an hour ago, fade to
                // grey — the row is history, not news.
                const departed = hasDeparted(flight);
                const spent = cancelled || departed || landedLongAgo(flight, now);
                const delay = index * ROW_TICKS;
                const status = flightStatus(flight, now, kind);

                // The night shift crosses midnight — mark where the new day starts.
                const startsNextDay = flight.nextDay && !flights[index - 1]?.nextDay;

                return (
                  // Keyed by position so the cells survive a date change and
                  // physically flip from the old flight to the new one.
                  <Fragment key={index}>
                    {startsNextDay ? (
                      <li className="flex items-center gap-2 pb-[3px] pt-1.5">
                        <span className="h-px flex-1 bg-flap-dim/40" />
                        <span className="font-signage text-[8px] uppercase tracking-[0.18em] text-flap-dim sm:text-[9px]">
                          Neste dag
                        </span>
                        <span className="h-px flex-1 bg-flap-dim/40" />
                      </li>
                    ) : null}
                  <li className="flex gap-1 sm:gap-2">
                    <SplitFlapText
                      value={flight.scheduled}
                      width={W.time}
                      flipKey={flipKey} className={spent ? "text-flap-dim" : "text-flap-ink"}
                    />
                    <SplitFlapText
                      value={cancelled ? "--:--" : displayTime(flight)}
                      width={W.eta}
                      flipKey={flipKey} className={cn(
                        spent
                          ? "text-flap-dim"
                          : delayed
                          ? "text-flap-red"
                          : isNewTime(flight)
                          ? "text-flap-amber"
                          : "text-flap-ink"
                      )}
                    />
                    <SplitFlapText
                      value={flight.flightId}
                      width={W.flight}
                      flipKey={flipKey} className={spent ? "text-flap-dim" : "text-flap-ink"}
                    />
                    <span className="flex shrink-0 items-start gap-1 sm:gap-2">
                      {/* Phone shows a shorter Fra/Til field so the four
                          visible columns fit without sideways scrolling. */}
                      <SplitFlapText
                        value={flight.airportName}
                        width={W.placeSm}
                        flipKey={flipKey} className={cn("sm:hidden", spent ? "text-flap-dim" : "text-flap-ink")}
                      />
                      <SplitFlapText
                        value={flight.airportName}
                        width={W.place}
                        flipKey={flipKey} className={cn(
                          "hidden sm:inline-flex",
                          spent ? "text-flap-dim" : "text-flap-ink"
                        )}
                      />
                      <SplitFlapText
                        value={flight.airportCode}
                        width={W.code}
                        flipKey={flipKey} className={cn(
                          "hidden sm:inline-flex",
                          spent ? "text-flap-dim" : "text-flap-amber"
                        )}
                      />
                    </span>
                    <span className="ml-auto flex shrink-0 items-start gap-1 sm:gap-2">
                      {showTrack ? (
                        <span className="flex w-4 shrink-0 items-center justify-center sm:w-5">
                          {isTrackable(flight) ? <TrackButton flight={flight} /> : null}
                        </span>
                      ) : null}
                      <SplitFlapText
                        value={status.label}
                        width={W.status}
                        flipKey={flipKey} className={cn("hidden sm:inline-flex", TONE_CLASS[status.tone])}
                      />
                    </span>
                  </li>
                  </Fragment>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
