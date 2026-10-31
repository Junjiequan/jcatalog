import { describe, expect, it } from "vitest";
import { fmtBytes, fmtCount, fmtNum, humanizeKey, initials, plural } from "./format";

describe("fmtBytes", () => {
  it("picks the unit that keeps the number short", () => {
    expect(fmtBytes(0)).toBe("0 B");
    expect(fmtBytes(848)).toBe("848 B");
    expect(fmtBytes(72_000)).toMatch(/KB$/);
    expect(fmtBytes(29.3 * 1024 ** 3)).toMatch(/GB$/);
  });
});

describe("counts and labels", () => {
  it("groups thousands and shortens large counts", () => {
    expect(fmtNum(3143)).toBe("3,143");
    expect(fmtCount(9_999)).toBe("9,999");
    expect(fmtCount(25_000)).not.toBe("25,000");
    expect(fmtCount(-1)).toBe("–");
  });
  it("pluralises", () => {
    expect(plural(1, "dataset")).toBe("1 dataset");
    expect(plural(13, "dataset")).toBe("13 datasets");
  });
  it("humanizes snake_case keys", () => {
    expect(humanizeKey("source_frequency")).toBe("Source frequency");
  });
  it("makes initials from a name, ignoring titles", () => {
    expect(initials("Dr. Ada Okafor")).toBe("AO");
  });
});
