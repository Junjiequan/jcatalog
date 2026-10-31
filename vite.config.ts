import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Settings live in config/ at the project root. The browser reads them as /filters.yaml and /app.yaml:
// served from config/ in development and copied into the build, so a deployment can replace them without rebuilding.
const RUNTIME_FILES = ["filters.yaml", "app.yaml"];
const runtimeConfig = (): Plugin => ({
  name: "runtime-config",
  configureServer(server) {
    // exactly the public address, so the bundled copy (config/app.yaml?raw) is left to Vite
    server.middlewares.use((req, res, next) => {
      const file = RUNTIME_FILES.find((f) => req.url?.split("?")[0] === `${server.config.base}${f}`);
      if (file) {
        res.setHeader("Content-Type", "text/yaml; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(readFileSync(`config/${file}`, "utf8"));
      } else next();
    });
  },
  generateBundle() {
    for (const f of RUNTIME_FILES) this.emitFile({ type: "asset", fileName: f, source: readFileSync(`config/${f}`, "utf8") });
  },
});

// VITE_BASE is the sub-path the app is served from (GitHub Pages: /jcatalog/); everywhere else it is the root
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss(), runtimeConfig()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // in a container file events from a bind mount do not arrive, so it polls: once a second, and not over build output
  server: {
    port: 4500,
    watch: { ignored: ["**/coverage/**", "**/dist/**"], ...(process.env.CHOKIDAR_USEPOLLING === "true" ? { usePolling: true, interval: 1000 } : {}) },
  },
  // fast: happy-dom instead of a full browser, and only the tests next to the code
  test: {
    environment: "happy-dom",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    restoreMocks: true,
    unstubGlobals: false,
    coverage: { provider: "v8", include: ["src/**/*.{ts,tsx}"], exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.d.ts", "src/main.tsx"], reporter: ["text-summary", "json-summary"],
      // a floor, not a goal: it fails the run when coverage drops, so new code arrives with its tests
      thresholds: { lines: 75, statements: 72, branches: 63, functions: 62 },
    },
  },
});
