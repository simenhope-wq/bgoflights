import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8000,
    // Dev-only: tells the browser never to cache anything from this server,
    // so a plain refresh always shows the latest code — no more needing a
    // hard refresh to see a change take effect. Doesn't touch the actual
    // production build/deploy at all, just this local dev server.
    headers: {
      "Cache-Control": "no-store",
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
