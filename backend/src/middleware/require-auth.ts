import type { MiddlewareHandler } from "hono";
import { hasValidSession, issueSession } from "../lib/auth.js";

/**
 * Gates a route behind the shared login cookie, and slides its expiry
 * forward on every authenticated request (see the 400-day cap explained in
 * lib/auth.ts) — so staying logged in only requires using the board at
 * least once within any 400-day stretch.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (!(await hasValidSession(c))) {
    return c.json({ error: { message: "Ikke logget inn.", code: "UNAUTHORIZED" } }, 401);
  }
  await issueSession(c);
  await next();
};
