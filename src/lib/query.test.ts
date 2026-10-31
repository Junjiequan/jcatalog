import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentUser } from "@/lib/session";
import { DEFAULT_QUERY, activeFilterCount, datasetLink, filterKey, isExperimentId, parseQuery, proposalLink, serializeQuery } from "./query";

beforeEach(() => setCurrentUser({ name: "Ada", email: "ada@example.org", role: "admin", groups: [] }));

describe("the dataset query in the URL", () => {
  it("round-trips the filters people set", () => {
    const sp = new URLSearchParams("q=lysozyme&inst=loki,beer&tech=SANS&kw=battery&type=raw&store=online");
    const q = parseQuery(sp);
    expect(q.q).toBe("lysozyme");
    expect(q.instruments).toEqual(["loki", "beer"]);
    expect(q.techniques).toEqual(["SANS"]);
    expect(q.types).toEqual(["raw"]);
    expect(serializeQuery(q).toString()).toBe(serializeQuery(parseQuery(serializeQuery(q))).toString());
  });

  it("leaves the URL empty when nothing is filtered", () => {
    expect(serializeQuery(parseQuery(new URLSearchParams())).toString()).toBe("");
  });

  it("only writes the scope when it differs from the person's default", () => {
    // an administrator defaults to everything, so "all" needs no parameter and "mine" does
    expect(serializeQuery({ ...DEFAULT_QUERY, scope: "all" }).get("scope")).toBeNull();
    expect(serializeQuery({ ...DEFAULT_QUERY, scope: "mine" }).get("scope")).toBe("mine");
  });

  it("counts the active filters for the badge", () => {
    expect(activeFilterCount(DEFAULT_QUERY)).toBe(0);
    expect(activeFilterCount(parseQuery(new URLSearchParams("inst=loki&tech=SANS&q=x")))).toBe(3);
  });

  it("changes the filter key when a filter changes, so cached pages are not reused", () => {
    const a = filterKey(DEFAULT_QUERY);
    expect(filterKey({ ...DEFAULT_QUERY, q: "x" })).not.toBe(a);
    expect(filterKey(DEFAULT_QUERY)).toBe(a);
  });
});

describe("links", () => {
  it("encodes a dataset id, whatever characters it holds", () => {
    expect(datasetLink("20.500.12269/abc def")).toBe("/datasets/20.500.12269%2Fabc%20def");
  });
  it("sends experiments (ids ending in -number) to their own list", () => {
    expect(isExperimentId("20240587-1")).toBe(true);
    expect(isExperimentId("20240587")).toBe(false);
    expect(proposalLink("20240587-1")).toBe("/experiments/20240587-1");
    expect(proposalLink("20240587")).toBe("/proposals/20240587");
  });
});
