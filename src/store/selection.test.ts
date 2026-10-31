import { beforeEach, describe, expect, it } from "vitest";
import type { Dataset } from "@/types";
import { byKind, datasetItem, selectionList, useSelection, type SelItem } from "./selection";

const ds = (pid: string, over: Partial<Dataset> = {}) => ({ pid, datasetName: `Run ${pid}`, size: 1000, numberOfFiles: 3, datasetlifecycle: { isOnCentralDisk: true }, ...over }) as unknown as Dataset;
const proposal: SelItem = { kind: "proposal", id: "20240311", name: "A proposal", link: "/proposals/20240311" };

beforeEach(() => useSelection.getState().clear());

describe("the selection", () => {
  it("toggles a dataset in and out", () => {
    const { toggle } = useSelection.getState();
    toggle(ds("A"));
    expect(Object.keys(useSelection.getState().items)).toEqual(["A"]);
    toggle(ds("A"));
    expect(useSelection.getState().items).toEqual({});
  });

  it("keeps what an action on datasets needs: size, files and where they live", () => {
    expect(datasetItem(ds("MDC/1"))).toMatchObject({ kind: "dataset", id: "MDC/1", name: "Run MDC/1", size: 1000, files: 3, link: "/datasets/MDC%2F1" });
  });

  it("adds many at once without losing what was there", () => {
    const s = useSelection.getState();
    s.toggle(ds("A"));
    s.addMany([ds("B"), ds("C")]);
    expect(Object.keys(useSelection.getState().items).sort()).toEqual(["A", "B", "C"]);
  });

  it("holds things of any kind together", () => {
    const s = useSelection.getState();
    s.toggle(ds("A"));
    s.toggleItem(proposal);
    expect(selectionList(useSelection.getState().items).map((i) => i.kind).sort()).toEqual(["dataset", "proposal"]);
    s.toggleItem(proposal);
    expect(useSelection.getState().items["20240311"]).toBeUndefined();
  });

  it("lists things in the order they were picked, even when an id looks like a number", () => {
    const s = useSelection.getState();
    s.toggle(ds("A"));
    s.toggleItem({ kind: "proposal", id: "20240311", name: "p", link: "/proposals/20240311" });
    s.toggle(ds("B"));
    expect(selectionList(useSelection.getState().items).map((i) => i.id)).toEqual(["A", "20240311", "B"]);
  });

  it("adding what is already selected keeps its place", () => {
    const s = useSelection.getState();
    s.addMany([ds("A"), ds("B")]);
    s.addMany([ds("B"), ds("C")]);
    expect(selectionList(useSelection.getState().items).map((i) => i.id)).toEqual(["A", "B", "C"]);
  });

  it("removes some and clears all", () => {
    const s = useSelection.getState();
    s.addMany([ds("A"), ds("B"), ds("C")]);
    s.removeMany(["A", "C"]);
    expect(Object.keys(useSelection.getState().items)).toEqual(["B"]);
    s.clear();
    expect(useSelection.getState().items).toEqual({});
  });

  it("restores what an undo brings back", () => {
    const s = useSelection.getState();
    s.restore([datasetItem(ds("A")), proposal]);
    expect(Object.keys(useSelection.getState().items).sort()).toEqual(["20240311", "A"]);
  });

  it("groups by kind in a fixed order, skipping kinds with nothing", () => {
    const groups = byKind([proposal, datasetItem(ds("A")), datasetItem(ds("B"))]);
    expect(groups.map(([k, l]) => [k, l.length])).toEqual([["dataset", 2], ["proposal", 1]]);
  });
});
