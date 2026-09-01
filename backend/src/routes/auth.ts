import { Hono } from "hono";
import { z } from "zod";
import { checkCredentials, clearSession, hasValidSession, issueSession } from "../lib/auth";
import { rateLimit } from "../middleware/rate-limit";

const authRouter = new Hono();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Much stricter than the general API limit — this is the one endpoint
// worth protecting against deliberate password-guessing, not just volume.
const loginRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "login:",
  message: "For mange innloggingsforsøk. Vent litt og prøv igjen.",
});

authRouter.post("/login", loginRateLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { message: "Brukernavn og passord kreves.", code: "INVALID_BODY" } },
      400
    );
  }

  const { username, password } = parsed.data;
  if (!checkCredentials(username, password)) {
    return c.json(
      { error: { message: "Feil brukernavn eller passord.", code: "INVALID_CREDENTIALS" } },
      401
    );
  }

  await issueSession(c);
  return c.json({ data: { ok: true } });
});

authRouter.post("/logout", (c) => {
  clearSession(c);
  return c.json({ data: { ok: true } });
});

authRouter.get("/me", async (c) => {
  const authenticated = await hasValidSession(c);
  return c.json({ data: { authenticated } });
});

export { authRouter };
