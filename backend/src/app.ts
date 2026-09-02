import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env.js";
import { authRouter } from "./routes/auth.js";
import { flightsRouter } from "./routes/flights.js";
import { privateJetsRouter } from "./routes/private-jets.js";
import { logger } from "hono/logger";
import { rateLimit } from "./middleware/rate-limit.js";

// The Hono app itself, with no runtime-specific bootstrapping (no dotenv,
// no @hono/node-server serve() call) so it can be imported by both:
// - local-server.ts (plain Node, via @hono/node-server, for local dev)
// - Vercel, which auto-detects this file (backend/ as the project's Root
//   Directory) via its default export and runs it as a Vercel Function —
//   see https://vercel.com/docs/frameworks/backend/hono ("zero configuration",
//   recognizes src/app.ts among a fixed set of filenames).
export const app = new Hono();

// CORS middleware - validates origin against allowlist.
// Localhost for dev, plus every deployed frontend this app has lived at:
// the old temporary Render static site, the Vercel production domain
// (grense.vercel.app) and any Vercel preview deployment for this project
// (grense-<hash>-hopemedia1.vercel.app), and grense.xyz once DNS points
// there (added up front so connecting the domain later doesn't need
// another deploy).
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/grense\.onrender\.com$/,
  /^https:\/\/grense\.vercel\.app$/,
  /^https:\/\/grense-[a-z0-9-]+-hopemedia1\.vercel\.app$/,
  /^https:\/\/(www\.)?grense\.xyz$/,
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

export default app;
