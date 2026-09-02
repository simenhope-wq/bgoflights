import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app";

// Plain-Node local dev/start entry point. Deliberately NOT named one of
// Vercel's zero-config Hono filenames (app.ts/index.ts/server.ts) so there's
// no ambiguity about which file Vercel picks up as the deployed function —
// see app.ts's comment. This file only runs locally (`npm run dev`/`npm start`).
const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Backend running at http://localhost:${info.port}`);
});
