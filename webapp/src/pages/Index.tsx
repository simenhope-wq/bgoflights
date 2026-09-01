import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/board/CopyButton";
import { DateStepper } from "@/components/board/DateStepper";
import { FlightSection } from "@/components/board/FlightSection";
import { OsloClock } from "@/components/board/OsloClock";
import { PrivateJetSection } from "@/components/board/PrivateJetSection";
import { SplitFlapText } from "@/components/board/SplitFlapText";
import { useFlightBoard } from "@/hooks/use-flight-board";
import { usePrivateJets } from "@/hooks/use-private-jets";
import { BorderCheckPanel } from "@/components/board/BorderCheckPanel";
import { ShiftFilter } from "@/components/board/ShiftFilter";
import {
  boardForShift,
  buildBoardBlocks,
  buildSectionBlocks,
  emptyCoverage,
  formatLongDate,
  jetsForShift,
  shiftDate,
  todayInOslo,
  type FlightBoard,
  type Shift,
} from "@/lib/flights";

const emptyBoard = (date: string): FlightBoard => ({
  date,
  airport: "BGO",
  airportName: "Bergen Airport Flesland",
  arrivals: [],
  departures: [],
  lastUpdate: "",
  notice: null,
  coverage: emptyCoverage(),
});

const Index = () => {
  const [date, setDate] = useState<string>(() => todayInOslo());
  const [shiftFilter, setShiftFilter] = useState<Shift | null>(null);
  // The backend caches each board for up to 60s, so a repeat request on
  // localhost can resolve in a handful of milliseconds — too fast for the
  // spin animation to ever actually paint, so pressing the button looked
  // like it did nothing even though the data really did refresh. Holding
  // the spin for at least half a second makes the click feel like it did
  // something, regardless of how fast the network round trip actually was.
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const { data, isLoading, isFetching, isError, error, refetch } = useFlightBoard(date);
  const jets = usePrivateJets(date);

  // The night shift runs past midnight, so the next day's small hours belong to
  // it. Loaded always, so the "kopier kveldskift" button is complete even while
  // the board itself is showing every flight.
  const nextDate = shiftDate(date, 1);
  const nextDay = useFlightBoard(nextDate);
  const nextJets = usePrivateJets(nextDate);

  const rawBoard = data ?? emptyBoard(date);
  const showingRequestedDate = rawBoard.date === date;

  const board = boardForShift(rawBoard, nextDay.data, shiftFilter);
  const shownJets = jetsForShift(jets.data, nextJets.data, shiftFilter);

  const dayBoard = boardForShift(rawBoard, nextDay.data, "day");
  const nightBoard = boardForShift(rawBoard, nextDay.data, "night");
  const dayJets = jetsForShift(jets.data, nextJets.data, "day");
  const nightJets = jetsForShift(jets.data, nextJets.data, "night");

  const shift = useCallback((days: number) => {
    setDate((current) => shiftDate(current, days));
  }, []);

  // Arrow keys step through days, as long as focus is not inside a control.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;
      if (event.key === "ArrowLeft") shift(-1);
      if (event.key === "ArrowRight") shift(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shift]);

  const updatedAt = rawBoard.lastUpdate
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Oslo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(rawBoard.lastUpdate))
    : null;

  const handleRefresh = () => {
    setManualRefreshing(true);
    Promise.all([
      refetch(),
      jets.refetch(),
      nextDay.refetch(),
      nextJets.refetch(),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]).finally(() => setManualRefreshing(false));
  };

  // Same control in both the phone and the desktop bar — declared once.
  const refreshButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Oppdater"
      onClick={handleRefresh}
      className="h-7 w-7 shrink-0 rounded-[2px] text-muted-foreground hover:bg-secondary hover:text-foreground sm:h-8 sm:w-8"
    >
      <RefreshCw
        className={isFetching || manualRefreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
      />
    </Button>
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-rule">
        <div className="relative mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-2 font-signage text-[9px] uppercase tracking-[0.24em] text-muted-foreground sm:px-8 sm:text-[10px]">
          <span>BGO · Schengen-grensetrafikk</span>
          {/* Absolutely centred so it stays dead middle whatever sits either side. */}
          <span className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 whitespace-nowrap tracking-[0.16em] text-foreground sm:block">
            {formatLongDate(date)}
            {updatedAt && showingRequestedDate ? ` · oppdatert ${updatedAt}` : ""}
          </span>
          <span className="flex items-center gap-2">
            <span className="hidden sm:inline">Lokal tid (Oslo)</span>
            <span className="hidden h-3 w-px bg-rule sm:inline-block" />
            <OsloClock className="text-foreground" />
          </span>
        </div>
      </div>

      {/* Wide enough for the 18px flaps to lay out at full column width. */}
      <div className="mx-auto max-w-4xl px-5 pb-24 pt-3 sm:px-8 sm:pt-4">
        <header className="flex flex-col items-center text-center">
          {/* The name spelled out on real flaps, like the board below */}
          <h1 className="flex justify-center">
            <SplitFlapText
              value="FLESLAND"
              width={8}
              className="flap-title text-[2.1rem] text-flap-ink sm:text-5xl"
              ariaLabel="Flesland"
            />
          </h1>
          <div className="hidden sm:mt-4 sm:block">
            <DateStepper date={date} onShift={shift} onToday={() => setDate(todayInOslo())} />
          </div>
        </header>

        <div className="sticky top-0 z-10 -mx-5 mt-1.5 border-b border-foreground/15 bg-background/95 px-5 py-2 backdrop-blur sm:-mx-8 sm:mt-2.5 sm:px-8 sm:py-3">
          {/* Phone: the stepper is centred on the page and the refresh button
              floats at the right, level with it. */}
          <div className="relative flex items-center justify-center gap-2 sm:hidden">
            <DateStepper date={date} onShift={shift} onToday={() => setDate(todayInOslo())} />
            <div className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-nowrap items-center gap-1">
              {refreshButton}
            </div>
          </div>
          {/* Stacked on the phone — the date line and the shift filter side by
              side are wider than a narrow screen. */}
          <div className="mt-2 flex flex-col items-center gap-1.5 sm:hidden">
            <p className="text-center font-signage text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {formatLongDate(date)}
              {updatedAt && showingRequestedDate ? ` · oppdatert ${updatedAt}` : ""}
            </p>
            <ShiftFilter value={shiftFilter} onChange={setShiftFilter} />
          </div>

          {/* Desktop: three equal columns, so the date sits dead centre with the
              shift filter and the copy buttons balanced either side of it. */}
          <div className="hidden sm:grid sm:grid-cols-3 sm:items-center sm:gap-3">
            <div className="flex justify-start">
              <ShiftFilter value={shiftFilter} onChange={setShiftFilter} />
            </div>
            {/* Empty middle column — the date now lives in the top strip. */}
            <span aria-hidden="true" />
            <div className="flex items-center justify-end gap-1.5">
              {refreshButton}
              <CopyButton
                getBlocks={() => buildBoardBlocks(dayBoard, dayJets, "day")}
                label="Kopier dagskift"
              />
              <CopyButton
                getBlocks={() => buildBoardBlocks(nightBoard, nightJets, "night")}
                label="Kopier kveldskift"
              />
            </div>
          </div>
        </div>

        {isError ? (
          <div className="mt-6 flex items-start gap-2.5 border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Kunne ikke hente flydata</p>
              <p className="mt-0.5 text-muted-foreground">
                {(error as Error)?.message ?? "Prøv igjen."}
              </p>
            </div>
          </div>
        ) : null}

        {board.notice ? (
          <p className="mt-6 border-l-2 border-foreground/25 pl-3 text-[13px] text-muted-foreground">
            {board.notice}
          </p>
        ) : null}

        {/* 12px matches the control bar's bottom padding, so the grey rule sits
            with equal air above and below it. */}
        <div className="mt-2.5 sm:mt-3">
          <FlightSection
            kind="departures"
            flights={board.departures}
            loading={isLoading}
            flipKey={`${board.date}-${shiftFilter ?? "all"}`}
            getCopyBlocks={(shift) => buildSectionBlocks(board, "departures", shift)}
          />
          <FlightSection
            kind="arrivals"
            flights={board.arrivals}
            loading={isLoading}
            flipKey={`${board.date}-${shiftFilter ?? "all"}`}
            getCopyBlocks={(shift) => buildSectionBlocks(board, "arrivals", shift)}
          />
          <PrivateJetSection
            date={board.date}
            board={shownJets}
            loading={jets.isLoading}
            flipKey={`${board.date}-${shiftFilter ?? "all"}`}
          />
        </div>

        {showingRequestedDate ? <BorderCheckPanel coverage={board.coverage} /> : null}

        <footer className="mt-12 border-t border-rule pt-4 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            Tavlen viser bare fly som krysser Schengen-grensen — til og fra flyplasser utenfor
            Schengen, som London Gatwick, Dublin, Aberdeen eller Antalya. Innenriksfly og fly
            internt i Schengen er utelatt.
          </p>
          <p className="mt-1.5">
            Privatfly-boksen viser forretningsfly utenfor rutetrafikken, sporet via ADS-B — de
            bevegelsene Avinor ikke publiserer. ETA/ETD står tom så lenge flyet går etter
            ruteplanen — den fylles bare når Avinor melder ny tid, og for ankomster først når
            flyet har lettet fra avgangsbyen. Statusfeltet følger samme fakta: I RUTE, NY TID
            (gul), FORSINKET (rød), AVREIST, LANDET eller INNSTILT. Ankomster som er i lufta får
            et radarikon ytterst til høyre — det åpner flyet på Flightradar24 i et nytt vindu.
            Bruk ← → for å bytte dag. Kopier-knappene legger ren tekst på utklippstavlen, klar
            for PowerPoint.
          </p>
          <p className="mt-6 text-center font-signage text-[10px] uppercase tracking-[0.24em]">
            Laget av Simen Thunes Hope
          </p>
        </footer>
      </div>
    </main>
  );
};

export default Index;
