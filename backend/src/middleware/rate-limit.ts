import type { Context, MiddlewareHandler } from "hono";

/**
 * Simple in-memory, fixed-window rate limiter, keyed by client IP. No
 * external dependency (Redis etc.) — this app runs as a single instance, so
 * a process-local Map is enough to stop any one visitor or bot from
 * hammering the server or, downstream, Avinor/OpenSky.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Sweep expired buckets periodically so long-running processes do not
// accumulate one entry per IP address forever.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  },
  5 * 60_000
).unref();

function clientIp(c: Context): string {
  // Render (and most proxies) set this; local dev has no proxy, so
  // everything local shares one bucket, which is fine for testing.
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return (forwarded.split(",")[0] ?? forwarded).trim();
  return c.req.header("x-real-ip") ?? "unknown";
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Separates this limiter's buckets from any other (e.g. login vs general API). */
  keyPrefix: string;
  message?: string;
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max, keyPrefix, message } = opts;
  return async (c, next) => {
    const key = keyPrefix + clientIp(c);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > max) {
        c.header("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
        return c.json(
          {
            error: {
              message: message ?? "For mange forespørsler. Prøv igjen om litt.",
              code: "RATE_LIMITED",
            },
          },
          429
        );
      }
    }

    await next();
  };
}
