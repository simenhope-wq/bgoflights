/**
 * Small in-memory cache shared by anything that calls out to a rate-limited
 * upstream (Avinor, OpenSky). Two jobs:
 *
 * 1. TTL caching — don't re-fetch upstream more often than `ttlMs`, no matter
 *    how many browsers are polling this server.
 * 2. Request coalescing — if the cache just expired and five requests land
 *    at once, only the first one actually calls `fn`; the rest wait on the
 *    same in-flight promise instead of firing four redundant upstream calls.
 *
 * Deliberately process-local (a plain Map, not Redis or similar) — this app
 * runs as a single instance, so that's enough to turn "N requests = N
 * upstream calls" into "N requests every ttlMs = 1 upstream call".
 */
interface CacheEntry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = fn()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      inFlight.delete(key);
      return value;
    })
    .catch((err) => {
      // Don't cache failures — the next request should just try again.
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  return promise;
}
