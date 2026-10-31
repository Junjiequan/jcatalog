import { describe, expect, it } from "vitest";
import { classifyStatus, humanizeStatus, isActiveJob, isFailedJob } from "./jobs";
import { matchesSearch } from "./search";
import { toSI } from "./units";
import { fmtDate, relTime, toISODate } from "./format";

describe("job status codes", () => {
  it.each([
    ["finishedSuccessful", "success"],
    ["finishedUnsuccessful", "failed"],
    ["finishedWithDatasetErrors", "partial"],
    ["jobSubmitted", "waiting"],
    ["inProgress", "running"],
    ["cancelled", "cancelled"],
    ["somethingNew", "other"],
  ])("%s is %s", (code, kind) => {
    expect(classifyStatus(code)).toBe(kind);
  });

  it("knows what is still going and what went wrong", () => {
    expect(isActiveJob({ statusCode: "inProgress" })).toBe(true);
    expect(isActiveJob({ statusCode: "finishedSuccessful" })).toBe(false);
    expect(isFailedJob({ statusCode: "finishedUnsuccessful" })).toBe(true);
    expect(isFailedJob({ statusCode: "finishedWithDatasetErrors" })).toBe(true);
  });

  it("shows an unknown code as it came, readable", () => {
    expect(humanizeStatus("finishedSuccessful")).toMatch(/finished successful/i);
  });
});

describe("search", () => {
  it("needs every word, anywhere, in any order, ignoring case", () => {
    expect(matchesSearch("lyso loki", "LOKI00050543", ["Lysozyme crystals"])).toBe(true);
    expect(matchesSearch("lyso beer", "LOKI00050543", ["Lysozyme crystals"])).toBe(false);
  });
  it("an empty search matches everything", () => {
    expect(matchesSearch("   ", "anything")).toBe(true);
  });
  it("skips missing fields", () => {
    expect(matchesSearch("a", undefined, null, "a")).toBe(true);
  });
});

describe("units", () => {
  it("converts to SI so values in different units compare", () => {
    expect(toSI(25, "°C")).toEqual({ value: 298.15, dim: "temperature" });
    expect(toSI(1, "nm")?.value).toBeCloseTo(1e-9);
    expect(toSI(10, "Å")?.value).toBeCloseTo(1e-9);
    expect(toSI(14, "Hz")).toEqual({ value: 14, dim: "frequency" });
  });
  it("does not guess an unknown unit", () => {
    expect(toSI(1, "furlongs")).toBeUndefined();
  });
});

describe("dates", () => {
  it("writes a date the way the whole app does", () => {
    expect(fmtDate("2026-10-28T08:00:00Z")).toBe("28 Oct 2026");
  });
  it("describes time from now in words", () => {
    expect(relTime(new Date().toISOString())).toBe("just now");
    expect(relTime(new Date(Date.now() - 3 * 86400000).toISOString())).toMatch(/3 days ago/);
  });
  it("makes an ISO day", () => {
    expect(toISODate(new Date("2026-10-28T23:59:00Z"))).toBe("2026-10-28");
  });
});
