import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { authRouter } from "./routes/auth";
import { flightsRouter } from "./routes/flights";
import { privateJetsRouter } from "./routes/private-jets";
import { logger } from "hono/logger";
import { rateLimit } from "./middleware/rate-limit";

const app = new Hono();

// CORS middleware - validates origin against allowlist.
// Local dev only for now (webapp on :8000 talking to backend on :3000).
// Production origins get added once hosting is decided.
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Health check endpoint (unauthenticated — used by uptime monitors)
app.get("/health", (c) => c.json({ status: "ok" }));

// General rate limit across the whole API — generous enough for normal use
// (the board polls every 60s, plus manual refreshes) while stopping a script
// or bot from hammering the server. The login route additionally has its own
// much stricter limit (see routes/auth.ts) against password-guessing.
app.use("/api/*", rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "api:" }));

// Auth routes (login/logout/me) are themselves unauthenticated —
// you need them precisely because you're not logged in yet.
app.route("/api/auth", authRouter);

// Everything else gates itself behind the shared login
// (each router calls .use("*", requireAuth) on itself).
app.route("/api/flights", flightsRouter);
app.route("/api/private-jets", privateJetsRouter);

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: { message: err.message, code: "INTERNAL" } }, 500);
});

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Backend running at http://localhost:${info.port}`);
});
