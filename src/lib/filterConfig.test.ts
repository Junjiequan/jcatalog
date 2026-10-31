import { describe, expect, it } from "vitest";
import bundled from "../../config/filters.yaml?raw";
import { defaultFilterConfig, parseFilterConfig } from "./filterConfig";

describe("config/filters.yaml", () => {
  it("the bundled default is valid and lists the panel's filters", () => {
    const { config, warnings } = parseFilterConfig(bundled);
    expect(warnings).toEqual([]);
    expect(config.filters.length).toBeGreaterThan(0);
    expect(config.filters).toEqual(defaultFilterConfig().filters);
  });

  it("keeps the order the file lists", () => {
    const { config } = parseFilterConfig("filters:\n  - field: keywords\n  - field: techniques\n");
    expect(config.filters.map((f) => f.field)).toEqual(["keywords", "techniques"]);
  });

  it("skips an unknown field and says so", () => {
    const { config, warnings } = parseFilterConfig("filters:\n  - field: nonsense\n  - field: techniques\n");
    expect(config.filters.map((f) => f.field)).toEqual(["techniques"]);
    expect(warnings.join(" ")).toMatch(/unknown field "nonsense"/);
  });

  it("falls back to a widget that fits the field, with a warning", () => {
    const { config, warnings } = parseFilterConfig("filters:\n  - field: techniques\n    widget: sliders\n");
    expect(config.filters[0].widget).not.toBe("sliders");
    expect(warnings.join(" ")).toMatch(/does not fit techniques/);
  });

  it("leaves out a filter marked enabled: false", () => {
    const { config } = parseFilterConfig("filters:\n  - field: techniques\n    enabled: false\n  - field: keywords\n");
    expect(config.filters.map((f) => f.field)).toEqual(["keywords"]);
  });

  it("uses the default panel when the file is not valid YAML or has no filters list", () => {
    expect(parseFilterConfig("filters: [").warnings.join(" ")).toMatch(/not valid YAML/);
    expect(parseFilterConfig("other: 1").warnings.join(" ")).toMatch(/top-level "filters:"/);
  });
});
