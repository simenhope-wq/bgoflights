import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Maximize2, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/board/CopyButton";
import { DateStepper } from "@/components/board/DateStepper";
import { LocalTimeBox } from "@/components/board/LocalTimeBox";
import { FlightSection } from "@/components/board/FlightSection";
import { ControlChime } from "@/components/board/ControlChime";
import { FeedStatusBadge, type FeedStatus } from "@/components/board/FeedStatusBadge";
import { NextControlPanel } from "@/components/board/NextControlPanel";
import { playChime } from "@/lib/chime";
import { OsloClock } from "@/components/board/OsloClock";
import { PrivateJetSection } from "@/components/board/PrivateJetSection";
import { SplitFlapText } from "@/components/board/SplitFlapText";
import { WeatherBadge } from "@/components/board/WeatherBadge";
import { useFlightBoard } from "@/hooks/use-flight-board";
import { useNow } from "@/hooks/use-now";
import { usePrivateJets } from "@/hooks/use-private-jets";
import { BorderCheckPanel } from "@/components/board/BorderCheckPanel";
import { ShiftFilter } from "@/components/board/ShiftFilter";
import {
  boardForShift,
  buildBoardBlocks,
  buildSectionBlocks,
  buildTerritorialBlocks,
  currentShiftInOslo,
  emptyCoverage,
  formatLongDate,
  isStaleForTerritorial,
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
  territorial: [],
  lastUpdate: "",
  notice: null,
  coverage: emptyCoverage(),
});

const Index = () => {
  const [date, setDate] = useState<string>(() => todayInOslo());
  // Defaults to whichever shift is actually running when the board is
  // opened (day before the 15:00 handover, night from then on) rather than
  // showing everything — a manual pick from here still overrides it.
  const [shiftFilter, setShiftFilter] = useState<Shift | null>(() => currentShiftInOslo());
  // Territorial is a separate view mode, not a shift: when on, the normal
  // four boxes (Avgang, Ankomst, the two private-jet boxes) are replaced by
  // a single Ankomst-Territorial box, unfiltered by shift or day-shift math
  // — the whole day, as asked.
  const [showTerritorial, setShowTerritorial] = useState(false);
  // Picking a shift always takes over from Territorial directly — no
  // separate step to "turn Territorial off" first.
  const selectShift = (next: Shift | null) => {
    setShiftFilter(next);
    setShowTerritorial(false);
  };
  // Board left open on a wall-mounted screen rather than someone's laptop —
  // deliberately low-key (see refreshButton/territorialToggle for the
  // controls people actually use every day) since this is a rare, one-off
  // flip rather than something to reach for often.
  const [kioskMode, setKioskMode] = useState(false);
  // Neste kontroll's five-minute chime (see ControlChime) — muted by
  // default (a board nobody has touched yet shouldn't start beeping on its
  // own), and persisted from there so a kiosk screen or a laptop remembers
  // whatever a person actually chose, in either direction, across reloads.
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("bgoflights-muted");
      return stored === null ? true : stored === "1";
    } catch {
      return true;
    }
  });
  const toggleMuted = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("bgoflights-muted", next ? "1" : "0");
      } catch {
        // Private browsing etc. — falls back to in-memory only for this tab.
      }
      // Unmuting plays a confirmation chime right here, synchronously in
      // the click handler — not left to ControlChime's useEffect, which
      // only fires it if a flight happens to be inside its five-minute
      // window at that exact moment (and which browsers can silently
      // block anyway, since by the time an effect runs it's a render
      // removed from the actual click). This way unmuting always audibly
      // confirms sound is working, on a guaranteed real user gesture.
      if (prev) playChime();
      return next;
    });
  };
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
  // Ticks every minute so a flight actually drops off Territorial once it
  // crosses the two-hour-since-landing mark, not just on the next refetch.
  const now = useNow();
  // Defensive: an older deployed backend that predates this field would
  // otherwise hand FlightSection an undefined array and crash the page.
  // Territorial also drops (not just fades) anything landed 2+ hours ago —
  // unlike the main board, it should read as who is actually still around.
  const territorialFlights = (rawBoard.territorial ?? []).filter(
    (f) => !isStaleForTerritorial(f, now)
  );

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

  // Only today's board actually auto-polls Avinor (see useFlightBoard), so
  // "is the feed healthy" only means something here — a past or future
  // date is a one-off fetch with nothing ongoing to vouch for.
  const viewingToday = date === todayInOslo();
  const feedAgeMs = rawBoard.lastUpdate ? now - new Date(rawBoard.lastUpdate).getTime() : null;
  // Judged on staleness rather than the raw isError flag: a failed refetch
  // already shows up as the board's age creeping past a normal 60s cycle,
  // and a single transient blip that resolves before anyone would notice
  // shouldn't flip the dot on its own. isError only breaks the tie before
  // any data has loaded at all (first paint vs. a first attempt that's
  // already failed).
  const feedStatus: FeedStatus =
    feedAgeMs === null
      ? isError
        ? "down"
        : "unstable"
      : feedAgeMs > 5 * 60_000
      ? "down"
      : feedAgeMs > 2 * 60_000
      ? "unstable"
      : "ok";

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

  // Deliberately faint until hovered/active — a rarely-used switch, not a
  // control meant to compete with refresh/theme for attention.
  const kioskToggle = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Kioskmodus (større tekst)"
      title="Kioskmodus (større tekst)"
      aria-pressed={kioskMode}
      onClick={() => setKioskMode((v) => !v)}
      className={cn(
        "h-7 w-7 shrink-0 rounded-[2px] opacity-40 transition-opacity hover:opacity-100 sm:h-8 sm:w-8",
        kioskMode
          ? "text-foreground opacity-100"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <Maximize2 className="h-3.5 w-3.5" />
    </Button>
  );

  // Mutes the Neste kontroll chime (ControlChime) without touching the
  // amber color/flash — those stay purely visual either way.
  const muteToggle = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={muted ? "Slå på lyd for neste kontroll" : "Demp lyd for neste kontroll"}
      title={muted ? "Slå på lyd for neste kontroll" : "Demp lyd for neste kontroll"}
      aria-pressed={muted}
      onClick={toggleMuted}
      className={cn(
        "h-7 w-7 shrink-0 rounded-[2px] transition-opacity sm:h-8 sm:w-8",
        muted
          ? "text-foreground opacity-100"
          : "text-muted-foreground opacity-40 hover:bg-secondary hover:text-foreground hover:opacity-100"
      )}
    >
      {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
    </Button>
  );

  return (
    <main
      className={cn("min-h-screen bg-background bg-cover bg-center bg-fixed", kioskMode && "kiosk-mode")}
      // <main> itself (not sticky, not fixed-positioned) carries the photo —
      // this exact combination was already proven to render correctly and
      // to coexist fine with sticky descendants. The wash bug only ever
      // showed up when a *sticky* element also carried its own
      // background-attachment: fixed (Safari mis-renders that specific
      // combination) — the control bar below no longer does that; it just
      // tints translucently over this photo instead.
      style={{
        backgroundImage:
          "linear-gradient(hsl(var(--background) / 0.35), hsl(var(--background) / 0.35)), url(/backgrounds/hangar-night.jpg)",
      }}
    >
      <div className="sticky top-0 z-20 border-b border-rule bg-black">
        <div className="relative mx-auto flex h-8 max-w-4xl items-center justify-between gap-3 px-5 font-signage text-[9px] uppercase tracking-[0.24em] text-muted-foreground sm:h-9 sm:px-8 sm:text-[10px]">
          <span className="flex min-w-0 items-center gap-2">
            {/* Desktop has its own centred date (below) with room to spare, so
                this corner stays the "BGO..." label there. On the phone that
                date has nowhere else to live once the sticky bar's own copy
                of it was dropped as a duplicate, so it takes this corner
                instead — same text, just relocated rather than shown twice. */}
            <span className="hidden sm:inline">BGO · Schengen-grensetrafikk</span>
            <span className="truncate whitespace-nowrap tracking-[0.16em] text-foreground sm:hidden">
              {formatLongDate(date)}
              {updatedAt && showingRequestedDate ? ` · oppdatert ${updatedAt}` : ""}
              {viewingToday && showingRequestedDate ? (
                <>
                  {" · "}
                  <FeedStatusBadge status={feedStatus} />
                </>
              ) : null}
            </span>
          </span>
          {/* Absolutely centred so it stays dead middle whatever sits either side. */}
          <span className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 whitespace-nowrap tracking-[0.16em] text-foreground sm:block">
            {formatLongDate(date)}
            {updatedAt && showingRequestedDate ? ` · oppdatert ${updatedAt}` : ""}
            {viewingToday && showingRequestedDate ? (
              <>
                {" · "}
                <FeedStatusBadge status={feedStatus} />
              </>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="hidden sm:inline">Lokal tid (Oslo)</span>
            <span className="hidden h-3 w-px bg-rule sm:inline-block" />
            <OsloClock className="text-foreground" />
          </span>
        </div>
      </div>

      {/* Wide enough for the 18px flaps to lay out at full column width. */}
      <div className="mx-auto max-w-4xl px-5 pb-24 pt-2 sm:px-8 sm:pt-3">
        <header className="flex flex-col items-center text-center">
          {/* Three equal columns (same idiom as the sticky control bar
              further down) so Neste kontroll sits flush at the page's own
              left margin — matching "BGO..." above it — rather than
              crowding the title, while the empty third column balances it
              out so FLESLAND still lands dead centre. The weather badge
              stays riding just off the title's own right edge (absolutely
              positioned, out of flow) rather than living in that third
              column, so its width never has to match column one's. Desktop
              only — Neste kontroll hides itself on narrow screens. The
              third column carries the mute toggle for its chime, sitting
              top-right directly under the Lokal tid clock above. */}
          <div className="grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-3">
            <div className="hidden sm:flex sm:justify-start">
              <NextControlPanel
                dayBoard={dayBoard}
                nightBoard={nightBoard}
                shift={shiftFilter}
              />
            </div>
            <div className="flex justify-center">
              <div className="relative inline-flex">
                <h1 className="flex justify-center">
                  <SplitFlapText
                    value="FLESLAND"
                    width={8}
                    className="flap-title text-[2.1rem] text-flap-ink sm:text-5xl"
                    ariaLabel="Flesland"
                  />
                </h1>
                <div className="absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap">
                  <WeatherBadge />
                </div>
              </div>
            </div>
            <div className="hidden sm:flex sm:justify-end">{muteToggle}</div>
          </div>
          <div className="hidden sm:mt-3 sm:block">
            <DateStepper date={date} onShift={shift} onToday={() => setDate(todayInOslo())} />
          </div>
          <div className="hidden sm:mt-2 sm:flex sm:justify-center">
            <LocalTimeBox />
          </div>
        </header>

        <div className="sticky top-[33px] z-10 -mx-5 mt-1 border-b border-foreground/15 bg-background/55 px-5 py-2 sm:top-[37px] sm:-mx-8 sm:mt-2.5 sm:px-8 sm:py-3">
          {/* Phone: the stepper is centred on the page and the refresh button
              floats at the right, level with it. */}
          <div className="relative flex items-center justify-center gap-2 sm:hidden">
            <DateStepper date={date} onShift={shift} onToday={() => setDate(todayInOslo())} />
            <div className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-nowrap items-center gap-1">
              {refreshButton}
            </div>
          </div>
          {/* The date used to repeat here on the phone (stacked above the
              shift filter, since side by side is wider than a narrow
              screen) — now shown once, top-left, instead of twice. */}
          <div className="mt-1.5 flex justify-center sm:hidden">
            <ShiftFilter
              value={shiftFilter}
              onChange={selectShift}
              territorialActive={showTerritorial}
              onToggleTerritorial={() => setShowTerritorial((v) => !v)}
            />
          </div>

          {/* Desktop: three equal columns, so the date sits dead centre with the
              shift filter and the copy buttons balanced either side of it. */}
          <div className="hidden sm:grid sm:grid-cols-3 sm:items-center sm:gap-3">
            <div className="flex justify-start">
              <ShiftFilter
                value={shiftFilter}
                onChange={selectShift}
                territorialActive={showTerritorial}
                onToggleTerritorial={() => setShowTerritorial((v) => !v)}
              />
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
              {kioskToggle}
            </div>
          </div>
        </div>

        {/* Mobile only — desktop already has Neste kontroll beside FLESLAND
            (see the header grid above). Sits below the shift filter and
            above the first yellow section, matching where it was asked
            for. */}
        <div className="mt-3 flex justify-center sm:hidden">
          <NextControlPanel
            dayBoard={dayBoard}
            nightBoard={nightBoard}
            shift={shiftFilter}
            layout="row"
          />
        </div>

        {/* Sound only — mounted once regardless of screen size, unlike the
            two NextControlPanel copies above (desktop/mobile), so the
            five-minute chime never plays twice for the same flight. */}
        <ControlChime dayBoard={dayBoard} nightBoard={nightBoard} shift={shiftFilter} muted={muted} />

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
          {showTerritorial ? (
            <FlightSection
              kind="arrivals"
              title="Ankomst Territorial"
              flights={territorialFlights}
              loading={isLoading}
              flipKey={`${rawBoard.date}-territorial`}
              getCopyBlocks={() => buildTerritorialBlocks(territorialFlights)}
            />
          ) : (
            <>
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
            </>
          )}
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
