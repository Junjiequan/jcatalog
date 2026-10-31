import { readFileSync } from "node:fs";
import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// a wait ends the moment its condition holds; the limit only matters when the machine is busy (the graph layout, a full run)
configure({ asyncUtilTimeout: 4000 });

// the DOM is emptied between tests, so one test never sees another's screen
afterEach(cleanup);

// What a browser has and happy-dom does not: enough for components to mount, not to draw.
// A canvas context that accepts every call (the seeded pictures are drawn on a canvas)
const context: object = new Proxy(
  {},
  {
    get: (_t, key) => {
      if (key === "getImageData" || key === "createImageData") return (w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (key === "measureText") return () => ({ width: 0 });
      // every call answers with the context itself, so a gradient's addColorStop and chained calls work
      return () => context;
    },
    set: () => true,
  },
);
HTMLCanvasElement.prototype.getContext = (() => context) as unknown as HTMLCanvasElement["getContext"];
HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,/9j/AA==";
HTMLElement.prototype.scrollIntoView = vi.fn();
class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= Observer as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= Observer as unknown as typeof IntersectionObserver;
URL.createObjectURL ??= () => "blob:test";
URL.revokeObjectURL ??= () => {};

// No test reaches a network. The two runtime config files are served from disk, as the dev server does; anything else is a 404.
vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  const file = /\/(filters|app)\.yaml(\?|$)/.exec(url)?.[1];
  if (file) return new Response(readFileSync(`config/${file}.yaml`, "utf8"), { status: 200, headers: { "content-type": "text/yaml" } });
  return new Response("not found", { status: 404 });
});
