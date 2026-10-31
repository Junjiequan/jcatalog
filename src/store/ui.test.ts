import { afterEach, describe, expect, it } from "vitest";
import { appConfig } from "@/lib/appConfig";
import { useUI } from "./ui";

afterEach(() => useUI.setState(useUI.getInitialState()));
const push = (pid: string, kind?: "dataset" | "proposal" | "experiment") => useUI.getState().pushRecent({ kind, pid, name: pid });

describe("recently viewed", () => {
  it("puts the newest first", () => {
    push("A");
    push("B");
    expect(useUI.getState().recent.map((r) => r.pid)).toEqual(["B", "A"]);
  });

  it("moves something seen again to the front instead of repeating it", () => {
    push("A");
    push("B");
    push("A");
    expect(useUI.getState().recent.map((r) => r.pid)).toEqual(["A", "B"]);
  });

  it("a dataset and a proposal with the same id are different things", () => {
    push("20240311", "dataset");
    push("20240311", "proposal");
    expect(useUI.getState().recent).toHaveLength(2);
  });

  it("an item saved before kinds existed counts as a dataset", () => {
    useUI.setState({ recent: [{ pid: "OLD", name: "old" }] });
    push("OLD", "dataset");
    expect(useUI.getState().recent).toHaveLength(1);
  });

  it("keeps only as many as config/app.yaml says", () => {
    for (let i = 0; i < appConfig().recentlyViewed + 5; i++) push(`P${i}`);
    expect(useUI.getState().recent).toHaveLength(appConfig().recentlyViewed);
    expect(useUI.getState().recent[0].pid).toBe(`P${appConfig().recentlyViewed + 4}`);
  });
});

describe("saved searches", () => {
  it("saves, renames and deletes", () => {
    const { saveSearch, updateSearch, deleteSearch } = useUI.getState();
    saveSearch("Cold runs", "tech=SANS");
    const [s] = useUI.getState().savedSearches;
    expect(s).toMatchObject({ name: "Cold runs", qs: "tech=SANS" });
    updateSearch(s.id, { name: "Cold lysozyme" });
    expect(useUI.getState().savedSearches[0].name).toBe("Cold lysozyme");
    deleteSearch(s.id);
    expect(useUI.getState().savedSearches).toEqual([]);
  });
  it("gives every saved search its own id", () => {
    useUI.getState().saveSearch("a", "q=1");
    useUI.getState().saveSearch("a", "q=1");
    const ids = useUI.getState().savedSearches.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("table columns", () => {
  it("toggles one column without touching the others", () => {
    const before = useUI.getState().columns;
    useUI.getState().toggleColumn("files");
    expect(useUI.getState().columns.files).toBe(!before.files);
    expect(useUI.getState().columns.size).toBe(before.size);
  });
});

describe("the panels on the right", () => {
  it("the preview and the selection keep a width each", () => {
    useUI.getState().set({ previewWidth: 400, selectionWidth: 400 });
    useUI.getState().set({ selectionWidth: 560 });
    expect(useUI.getState().previewWidth).toBe(400);
    expect(useUI.getState().selectionWidth).toBe(560);
  });
});
