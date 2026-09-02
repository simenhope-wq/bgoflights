import { Fragment } from "react";
import { cn } from "@/lib/utils";
import {
  boardHeading,
  buildPrivateJetBlocks,
  type CopyBlock,
  type PrivateJetBoard,
  type PrivateJet,
} from "@/lib/flights";
import { ColumnLabel } from "./ColumnLabel";
import { CopyButton } from "./CopyButton";
import { SectionPlate } from "./SectionPlate";
import { SplitFlapText } from "./SplitFlapText";

interface PrivateJetSectionProps {
  date: string;
  board: PrivateJetBoard | undefined;
  loading: boolean;
  flipKey: string;
}

const W = { time: 5, move: 3, callsign: 7, place: 24, code: 3 } as const;
const ROW_TICKS = 3;

function JetBoard({
  title,
  arriving,
  jets,
  loading,
  flipKey,
  off,
  stacked,
  getCopyBlocks,
}: {
  title: string;
  /** Picks the plane icon on the header plate. */
  arriving: boolean;
  jets: PrivateJet[];
  loading: boolean;
  flipKey: string;
  off: boolean;
  /** True for a board that sits directly under another one, borders touching. */
  stacked: boolean;
  getCopyBlocks: () => CopyBlock[];
}) {
  return (
    <section className={stacked ? "-mt-px" : "mt-3 sm:mt-6"}>
      <SectionPlate
        title={title}
        arriving={arriving}
        note={loading ? "· · ·" : off ? "ADS-B av" : `${jets.length} fly`}
        actions={
          <CopyButton
            getBlocks={getCopyBlocks}
            label={`Kopier ${title.toLowerCase()}`}
            className="hidden border-plate-ink/45 text-plate-ink hover:border-plate-ink hover:bg-plate-ink hover:text-plate dark:border-plate-ink/45 dark:text-plate-ink dark:hover:border-plate-ink dark:hover:bg-plate-ink dark:hover:text-plate sm:inline-flex"
          />
        }
      />

      <div
        className="overflow-x-auto rounded-b-[3px] border border-board-frame px-3 pb-3 pt-2.5 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.65)]"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 0%, hsl(var(--board)) 0%, hsl(var(--board-deep)) 100%)",
        }}
      >
        <div className="text-[12px] leading-tight sm:text-[18px]">
          <div className="flex gap-1 pb-2 text-flap-ink sm:gap-2">
            <ColumnLabel label="Tid" width={W.time} />
            <ColumnLabel label="Inn" width={W.move} />
            <ColumnLabel label="Kall." width={W.callsign} className="hidden sm:inline-block" />
            <span className="flex shrink-0 items-start gap-1 sm:gap-2">
              <ColumnLabel label="Fra / Til" width={W.place} />
              <ColumnLabel label="" width={W.code} className="hidden sm:inline-block" />
            </span>
          </div>

          {loading ? (
            <div className="space-y-[3px]">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex gap-1 sm:gap-2">
                  <SplitFlapText value="" width={W.time} className="text-flap-dim" />
                  <SplitFlapText value="" width={W.move} className="text-flap-dim" />
                  <SplitFlapText value="" width={W.place} className="text-flap-dim" />
                </div>
              ))}
            </div>
          ) : jets.length === 0 ? (
            <div className="space-y-[3px] py-1">
              <div>
                <SplitFlapText
                  value={off ? "ADS-B SPORING AV -" : "INGEN PRIVATFLY REGISTRERT -"}
                  width={28}
                  flipKey={flipKey}
                  className="text-flap-dim"
                />
              </div>
              <div>
                <SplitFlapText
                  value="SJEKK FLIGHT RADAR"
                  width={28}
                  flipKey={flipKey}
                  className="text-flap-dim"
                />
              </div>
            </div>
          ) : (
            <ol className="space-y-[3px]">
              {jets.map((jet, index) => {
                const delay = index * ROW_TICKS;
                const startsNextDay = jet.nextDay && !jets[index - 1]?.nextDay;

                return (
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
                      value={jet.time}
                      width={W.time}
                      flipKey={flipKey} className="text-flap-ink"
                    />
                    <SplitFlapText
                      value="INN"
                      width={W.move}
                      flipKey={flipKey} className="text-flap-amber"
                    />
                    <SplitFlapText
                      value={jet.callsign}
                      width={W.callsign}
                      flipKey={flipKey} className="hidden text-flap-ink sm:inline-flex"
                    />
                    <span className="flex shrink-0 items-start gap-1 sm:gap-2">
                      <SplitFlapText
                        value={jet.unknownRoute ? "UKJENT RUTE" : jet.airportName}
                        width={W.place}
                        flipKey={flipKey} className={cn(jet.unknownRoute ? "text-flap-dim" : "text-flap-ink")}
                      />
                      <SplitFlapText
                        value={jet.airportCode}
                        width={W.code}
                        flipKey={flipKey} className="hidden text-flap-amber sm:inline-flex"
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

export function PrivateJetSection({ date, board, loading, flipKey }: PrivateJetSectionProps) {
  const movements = board?.movements ?? [];
  const off = board ? !board.available : false;
  const arrivals = movements.filter((m) => m.kind === "arrival");
  const departures = movements.filter((m) => m.kind === "departure");

  return (
    <>
      <JetBoard
        title="Privatfly avgang"
        arriving={false}
        jets={departures}
        loading={loading}
        flipKey={flipKey}
        off={off}
        stacked={false}
        getCopyBlocks={() => [boardHeading(date), ...buildPrivateJetBlocks(departures)]}
      />
      <JetBoard
        title="Privatfly ankomst"
        arriving
        jets={arrivals}
        loading={loading}
        flipKey={flipKey}
        off={off}
        stacked
        getCopyBlocks={() => [boardHeading(date), ...buildPrivateJetBlocks(arrivals)]}
      />
      {board?.notice ? (
        <p className="mt-6 border-l-2 border-foreground/25 pl-3 text-[13px] text-muted-foreground">
          {board.notice}
        </p>
      ) : null}
    </>
  );
}
