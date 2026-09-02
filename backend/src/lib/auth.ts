/**
 * Single shared team login. Deliberately simple by design (word-of-mouth
 * username/password, one set of credentials for the whole team) — see
 * SITE_USERNAME / SITE_PASSWORD / AUTH_SECRET in env.ts.
 *
 * A signed cookie (Hono's built-in cookie signing, HMAC-SHA256 under the
 * hood) marks a browser as logged in. It carries no secret data itself —
 * only a signature proving this server issued it — so tampering with the
 * value invalidates the signature and getSignedCookie() returns false.
 */
import { getSignedCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import { env } from "../env.js";

export const SESSION_COOKIE = "flesland_session";

/**
 * Browsers (Chrome since 2023, and the current cookie spec) cap any single
 * cookie's lifetime at 400 days — Hono itself now rejects anything longer.
 * So instead of one long-lived cookie, this is the max allowed, refreshed on
 * every authenticated request (see middleware/require-auth.ts): a sliding
 * window, so anyone using the board at least once a year never sees the
 * login screen again, without relying on a duration no browser honours.
 */
const MAX_COOKIE_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * Lax works fine in local dev (frontend and backend are both localhost, just
 * different ports — same "site" for cookie purposes). In production the
 * webapp is a separate Render static site (and eventually its own domain)
 * from the backend, a genuinely cross-origin fetch — Lax cookies are not
 * sent on those, only on top-level navigations. None is the one that works
 * cross-origin, and browsers require Secure whenever None is used, which is
 * already true in production (Render serves everything over HTTPS).
 */
const COOKIE_SAME_SITE = env.NODE_ENV === "production" ? "None" : "Lax";

export async function issueSession(c: Context): Promise<void> {
  await setSignedCookie(c, SESSION_COOKIE, "authenticated", env.AUTH_SECRET, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: COOKIE_SAME_SITE,
    path: "/",
    maxAge: MAX_COOKIE_AGE_SECONDS,
  });
}

export async function hasValidSession(c: Context): Promise<boolean> {
  const value = await getSignedCookie(c, env.AUTH_SECRET, SESSION_COOKIE);
  return value === "authenticated";
}

export function clearSession(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, {
    path: "/",
    secure: env.NODE_ENV === "production",
    sameSite: COOKIE_SAME_SITE,
  });
}

export function checkCredentials(username: string, password: string): boolean {
  return username === env.SITE_USERNAME && password === env.SITE_PASSWORD;
}
