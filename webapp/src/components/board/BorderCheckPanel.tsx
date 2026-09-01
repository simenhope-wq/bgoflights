import { AlertTriangle, Check, Info } from "lucide-react";
import type { Coverage } from "@/lib/flights";

/**
 * The board's own receipt: how many flights were checked, how the Schengen border
 * was decided, and anything that needs a human look. Collapsed by default so it
 * does not compete with the board itself.
 */
export function BorderCheckPanel({ coverage }: { coverage: Coverage }) {
  const c = coverage;
  if (!c.inWindow) return null;

  const allResolved = c.countryResolved === c.inWindow && !c.countryCheckSkipped;
  const attention =
    c.unresolved.length > 0 || c.addedByCountryList.length > 0 || c.countryCheckSkipped;

  return (
    <details className="mt-8 border border-rule text-[11px] leading-relaxed text-muted-foreground">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 font-signage text-[10px] uppercase tracking-[0.18em] text-foreground/80">
        {attention ? (
          <AlertTriangle className="h-3.5 w-3.5 text-[hsl(45_90%_45%)]" />
        ) : (
          <Check className="h-3.5 w-3.5 text-board" />
        )}
        Grensekontroll · {c.included} av {c.inWindow} fly
      </summary>

      <div className="space-y-2 border-t border-rule px-3 py-3">
        <p>
          Alle {c.inWindow} avganger og ankomster Avinor har publisert for denne dagen er
          vurdert to ganger: mot Avinors eget S/D/I-merke ({c.byAvinorFlag.I} merket
          utenfor Schengen, {c.byAvinorFlag.S} internt i Schengen, {c.byAvinorFlag.D}{" "}
          innenriks) og mot vår egen liste over de {c.reference.schengenCountries}{" "}
          Schengen-landene ({c.reference.euCountries} EU-land er merket for tollformål).
          Et fly havner på tavlen hvis <em>én</em> av kontrollene sier at det krysser
          grensen.
        </p>

        <p>
          {c.reference.rule} Nye ruter til land utenfor Schengen kommer derfor med
          automatisk, uten endringer i systemet.
        </p>

        {allResolved ? (
          <p className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-board" />
            Alle {c.inWindow} flyplasskoder ble slått opp med land — ingen ukjente koder,
            og de to kontrollene er enige.
          </p>
        ) : null}

        {c.countries.length ? (
          <p>
            Land utenfor Schengen på tavlen i dag:{" "}
            {c.countries
              .map((x) => `${x.code}${x.eu ? " (EU)" : ""} ×${x.flights}`)
              .join(" · ")}
          </p>
        ) : null}

        {c.addedByCountryList.length ? (
          <p className="flex items-start gap-1.5 text-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Lagt til av landlisten (Avinor merket dem ikke som utenfor Schengen):{" "}
            {c.addedByCountryList
              .map((f) => `${f.flightId} ${f.airportCode} (${f.country})`)
              .join(", ")}
          </p>
        ) : null}

        {c.flagDisagreements.length ? (
          <p>
            Avinor merket som utenfor Schengen, men landet står på Schengen-listen —
            beholdt på tavlen:{" "}
            {c.flagDisagreements
              .map((f) => `${f.flightId} ${f.airportCode} (${f.country})`)
              .join(", ")}
          </p>
        ) : null}

        {c.unresolved.length ? (
          <p className="flex items-start gap-1.5 text-foreground">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[hsl(45_90%_45%)]" />
            Ukjente flyplasskoder ({c.unresolved.join(", ")}) — tatt med på tavlen for
            sikkerhets skyld, ikke utelatt.
          </p>
        ) : null}

        {c.countryCheckSkipped ? (
          <p className="flex items-start gap-1.5 text-foreground">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[hsl(45_90%_45%)]" />
            Landoppslaget var utilgjengelig nå — kun Avinors eget merke er brukt for
            denne oppdateringen.
          </p>
        ) : null}

        <p className="text-muted-foreground/70">
          Schengen-listen sist gjennomgått {c.reference.reviewed}.
        </p>
      </div>
    </details>
  );
}
