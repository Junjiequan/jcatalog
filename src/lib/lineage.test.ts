import { describe, expect, it, vi } from "vitest";
import type { Dataset } from "@/types";
import { loadLineage, softwareLabel } from "./lineage";

// a small catalogue: raw A and B; A -> A1 -> A2 and A -> A3; A and B -> M (merged); a stranger S shares A's proposal
const make = (pid: string, input: string[] = []) => ({ pid, inputDatasets: input, usedSoftware: input.length ? ["https://github.com/x/tool v1"] : [] }) as unknown as Dataset;
const all = Object.fromEntries([make("A"), make("B"), make("A1", ["A"]), make("A2", ["A1"]), make("A3", ["A"]), make("M", ["A", "B"]), make("S")].map((d) => [d.pid, d]));

vi.mock("@/api", () => ({
  api: {
    datasets: {
      related: async (pid: string) => ({
        sources: all[pid].inputDatasets.map((p) => all[p]),
        derived: Object.values(all).filter((x) => x.inputDatasets.includes(pid)),
        siblings: Object.values(all).filter((x) => x.pid !== pid),
      }),
    },
  },
}));

const pids = (l: { nodes: { d: Dataset }[] }) => l.nodes.map((n) => n.d.pid).sort();

describe("lineage", () => {
  it("is the dataset, what it came from and what came from it", async () => {
    const l = await loadLineage(all.A);
    expect(pids(l)).toEqual(["A", "A1", "A2", "A3", "M"]);
  });

  it("does not include siblings or the other inputs of a merge", async () => {
    expect(pids(await loadLineage(all.A))).not.toContain("S");
    // B only feeds M, which A also feeds: it is not an ancestor or descendant of A
    expect(pids(await loadLineage(all.A))).not.toContain("B");
  });

  it("walks up through a chain and shows both inputs of a merge", async () => {
    expect(pids(await loadLineage(all.A2))).toEqual(["A", "A1", "A2"]);
    expect(pids(await loadLineage(all.M))).toEqual(["A", "B", "M"]);
  });

  it("marks each dataset's role and depth", async () => {
    const l = await loadLineage(all.A1);
    const by = Object.fromEntries(l.nodes.map((n) => [n.d.pid, n]));
    expect(by.A1).toMatchObject({ role: "current", depth: 0 });
    expect(by.A).toMatchObject({ role: "source", depth: -1 });
    expect(by.A2).toMatchObject({ role: "derived", depth: 1 });
  });

  it("links an input to what it produced, carrying the software", async () => {
    const l = await loadLineage(all.A);
    expect(l.edges).toContainEqual({ from: "A", to: "A1", software: "https://github.com/x/tool v1" });
    expect(l.edges.every((e) => e.from !== e.to)).toBe(true);
  });

  it("a dataset with no relations is alone", async () => {
    expect(pids(await loadLineage(all.S))).toEqual(["S"]);
  });
});

describe("the name of the software on an arrow", () => {
  it("is the package and its version, without the address", () => {
    expect(softwareLabel("https://github.com/scipp/esssans v24.12.0")).toBe("esssans v24.12.0");
    expect(softwareLabel("https://github.com/mantidproject/mantid/ v6.11.0")).toBe("mantid v6.11.0");
  });
  it("keeps a name that is not an address, and says nothing when there is none", () => {
    expect(softwareLabel("mantid")).toBe("mantid");
    expect(softwareLabel(undefined)).toBeUndefined();
    expect(softwareLabel("")).toBeUndefined();
  });
});
