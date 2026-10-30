import { defineConfig, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Settings live in config/ at the project root. The filter panel's file is still read by the browser as /filters.yaml:
// served from config/ in development and copied into the build, so a deployment can replace it without rebuilding.
const filtersYaml = (): Plugin => ({
  name: "filters-yaml",
  configureServer(server) {
    // exactly the public address, so the bundled copy (config/filters.yaml?raw) is left to Vite
    const publicUrl = `${server.config.base}filters.yaml`;
    server.middlewares.use((req, res, next) => {
      if (req.url?.split("?")[0] === publicUrl) {
        res.setHeader("Content-Type", "text/yaml; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(readFileSync("config/filters.yaml", "utf8"));
      } else next();
    });
  },
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "filters.yaml", source: readFileSync("config/filters.yaml", "utf8") });
  },
});

// VITE_BASE is the sub-path the app is served from (GitHub Pages: /jcatalog/); everywhere else it is the root
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss(), filtersYaml()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // polling when running in a container, where file events from a bind mount do not arrive
  server: { port: 5173, watch: process.env.CHOKIDAR_USEPOLLING === "true" ? { usePolling: true, interval: 300 } : undefined },
});
