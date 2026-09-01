# Flesland Border Board

Vintage split-flap arrivals and departures board for **Bergen Airport Flesland (BGO)**, showing
only flights that **cross the Schengen border** — to and from airports outside the Schengen area
(London Gatwick, Dublin, Aberdeen, Antalya …). Built to be read at a glance and copied straight
into PowerPoint.

## What it does

- Lists **Arriving** first, then **Departing**, sorted by scheduled time.
- Shows scheduled time, **ETA/ETD** (the airline's latest published time), flight number,
  origin/destination and status.
- Only Schengen-border crossings — domestic Norwegian and Schengen-internal flights are filtered
  out.
- Opens on today's date (Europe/Oslo); ← → arrow buttons or arrow keys step one day at a time,
  with a "Today" shortcut. Changing the date makes every flap roll over from the old flight to the
  new one, cascading down the board.
- **Copy** buttons put unformatted, tab-separated text on the clipboard (whole board or one
  section) so it pastes cleanly into PowerPoint or Word.
- Today's board auto-refreshes every 60 seconds.

## Data source

Avinor's public flight data feed (`asrv.avinor.no`). Border-crossing flights are those the feed
marks `dom_int = I` (`S` is Schengen-internal, `D` is domestic Norway). Airline names, airport names and status texts come from Avinor's lookup feeds and
are cached in memory for 24 hours. Avinor publishes about 48 hours of history and roughly a week
ahead; outside that window the app shows a short notice.

## Structure

```
backend/
  src/types.ts            Zod contracts: FlightSchema, FlightBoardSchema
  src/lib/avinor.ts       Avinor XML feed client, Oslo timezone helpers
  src/routes/flights.ts   GET /api/flights?date=YYYY-MM-DD → { data: FlightBoard }
webapp/
  src/pages/Index.tsx                 The board page
  src/components/board/FleslandMark   Logo: Bergen's seven mountains + a departing plane
  src/components/board/DateStepper    Day arrows + Today
  src/components/board/FlightSection  Arriving / Departing split-flap board
  src/components/board/SplitFlapText  The flap mechanics (drum, stagger, flip animation)
  src/components/board/CopyButton     Plain-text clipboard copy
  src/hooks/use-flight-board.ts       React Query loader (60s refresh on today)
  src/lib/flights.ts                  Types, date helpers, copy-text builders
```

## Design

A Solari split-flap board mounted on a white wall: brushed-metal header plate, charcoal flaps with
a seam across the middle, warm-white glyphs. Display type is **Fraunces**, signage is **Oswald**,
the flaps are **IBM Plex Mono**. Amber marks a newly published time and the airport code, red marks
a delay of five minutes or more and cancellations.

## API

`GET /api/flights?date=YYYY-MM-DD` (defaults to today in Oslo)

```json
{ "data": { "date": "2026-08-27", "airport": "BGO", "arrivals": [...], "departures": [...],
            "lastUpdate": "...", "notice": null } }
```
