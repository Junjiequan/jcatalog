import { afterEach, describe, expect, it, vi } from "vitest";
import { appConfig, loadAppConfig } from "./appConfig";

const serve = (body: string, ok = true) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok, text: async () => body })));

afterEach(async () => {
  vi.unstubAllGlobals();
  serve("recentlyViewed: 10");
  await loadAppConfig();
});

describe("config/app.yaml", () => {
  it("starts from the bundled default", () => {
    expect(appConfig().recentlyViewed).toBe(10);
  });
  it("takes a value served next to the page", async () => {
    serve("recentlyViewed: 3");
    await loadAppConfig();
    expect(appConfig().recentlyViewed).toBe(3);
  });
  it("ignores a value outside 1 to 50 and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    serve("recentlyViewed: 500");
    await loadAppConfig();
    expect(appConfig().recentlyViewed).toBe(10);
    expect(warn).toHaveBeenCalled();
  });
  it("keeps what it has when the file cannot be fetched", async () => {
    serve("recentlyViewed: 4");
    await loadAppConfig();
    serve("", false);
    await loadAppConfig();
    expect(appConfig().recentlyViewed).toBe(4);
  });
});
