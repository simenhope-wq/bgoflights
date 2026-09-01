import { useEffect, useState } from "react";

/**
 * Wall-clock time in milliseconds, refreshed on an interval.
 *
 * Needed for styling that depends on how long ago something happened: the
 * flight data itself does not change when a landing passes the one-hour mark,
 * so without a tick the row would never fade.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
