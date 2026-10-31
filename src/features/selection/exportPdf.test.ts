import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api";
import { DEFAULT_QUERY } from "@/lib/query";
import { datasetItem, type SelItem } from "@/store/selection";
import { exportPdf, selectionHtml } from "./exportPdf";

beforeEach(async () => {
  await api.auth.signInDemo!("admin@example.org");
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await api.auth.signOut();
});

const firstDataset = async () => (await api.datasets.list({ ...DEFAULT_QUERY, scope: "all", pageSize: 1 })).items[0];

describe("the printable export of a selection", () => {
  it("has a section per kind with the full record of each item", async () => {
    const d = await firstDataset();
    const proposal = (await api.proposals.list())[0];
    const html = await selectionHtml([
      datasetItem(d),
      { kind: "proposal", id: proposal.proposalId, name: proposal.title, link: "" },
      { kind: "instrument", id: "loki", name: "LoKI", link: "" },
      { kind: "sample", id: (await api.samples.list())[0].sampleId, name: "s", link: "" },
    ]);
    expect(html).toContain("<h2>Datasets · 1</h2>");
    expect(html).toContain("<h2>Proposals · 1</h2>");
    expect(html).toContain("<h2>Instruments · 1</h2>");
    expect(html).toContain("<h2>Samples · 1</h2>");
    expect(html).toContain(d.pid);
    expect(html).toContain("Scientific metadata");
    expect(html).toContain("4 items");
  });

  it("escapes what comes from the data, so a name cannot inject markup", async () => {
    const d = await firstDataset();
    await api.datasets.update(d.pid, { datasetName: '<img src=x onerror="alert(1)">', description: "<script>steal()</script>" });
    const html = await selectionHtml([datasetItem(d)]);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>steal()");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    await api.datasets.update(d.pid, { datasetName: d.datasetName, description: d.description });
  });

  it("says plainly when an item is no longer there", async () => {
    const item: SelItem = { kind: "job", id: "JOB-does-not-exist", name: "Gone job", link: "" };
    expect(await selectionHtml([item])).toContain("Not found.");
  });

  it("is handed to the browser's print dialog in a new tab", async () => {
    const write = vi.fn();
    const win = { document: { write, open: vi.fn(), close: vi.fn() } };
    vi.stubGlobal("open", vi.fn(() => win));
    await exportPdf([datasetItem(await firstDataset())]);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0]).toContain("window.print()");
  });

  it("fails loudly when the browser blocks the new tab", async () => {
    vi.stubGlobal("open", vi.fn(() => null));
    await expect(exportPdf([datasetItem(await firstDataset())])).rejects.toThrow("popup");
  });
});
