export type FeedStatus = "ok" | "unstable" | "down";

const FEED_STATUS: Record<FeedStatus, { label: string; dotColor: string }> = {
  ok: { label: "I DRIFT", dotColor: "hsl(var(--flap-green))" },
  unstable: { label: "USTABIL", dotColor: "hsl(var(--flap-amber))" },
  down: { label: "NEDE", dotColor: "hsl(var(--flap-red))" },
};

/**
 * How much to trust the board right now — whether Avinor's feed is actually
 * being polled successfully, as distinct from whether any individual flight
 * looks delayed. Sits next to "oppdatert HH:MM" in the top bar, today's
 * board only — an older or future date doesn't auto-poll (see
 * useFlightBoard), so there's no live feed to vouch for there.
 *
 * The label itself is plain inline text (not wrapped in a flex box) so it
 * sits on exactly the same baseline as the rest of the line — an
 * `inline-flex` wrapper here previously centered it against its own box
 * instead, which read as sitting a little low/off compared to the
 * surrounding all-caps text. Only the dot gets `align-middle`, the
 * standard trick for a small inline status dot next to running text; its
 * color is set inline (a CSS var, not a Tailwind bg-flap-* class) since
 * none of the flap tones had ever been used as a background anywhere else
 * in the app and the utility class wasn't generating.
 */
export function FeedStatusBadge({ status }: { status: FeedStatus }) {
  const { label, dotColor } = FEED_STATUS[status];
  return (
    <span className="ml-1">
      <span
        className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
