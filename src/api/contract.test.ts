import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_MODE, api } from "@/api";
import { DEFAULT_QUERY } from "@/lib/query";
import { setCurrentUser } from "@/lib/session";
import { textToDataUrl } from "@/lib/attachments";
import type { Dataset, DatasetQuery } from "@/types";

// What every backend behind CatalogApi must do, as the screens rely on it. It runs against the mock today
// and is written so the SciCat adapter can be pointed at the same tests once it exists.
const run = describe.skipIf(API_MODE !== "mock");

const all = (over: Partial<DatasetQuery> = {}): DatasetQuery => ({ ...DEFAULT_QUERY, scope: "all", ...over });
const names = (ds: Dataset[]) => ds.map((d) => d.datasetName);
const signIn = async (email: string) => {
  const r = await api.auth.signInDemo!(email);
  if (!r.ok) throw new Error(r.error);
  setCurrentUser(r.user);
};

run("the datasets list", () => {
  beforeAll(() => signIn("admin@example.org"));

  it("returns one page at a time and says whether there is another", async () => {
    const page = await api.datasets.list(all({ pageSize: 10 }));
    expect(page.items).toHaveLength(10);
    expect(page.hasMore).toBe(true);
  });

  it("pages do not overlap, and the last page says there is no more", async () => {
    const seen = new Set<string>();
    let q = all({ pageSize: 100, page: 1 });
    for (;;) {
      const p = await api.datasets.list(q);
      for (const d of p.items) {
        expect(seen.has(d.pid)).toBe(false);
        seen.add(d.pid);
      }
      if (!p.hasMore) break;
      q = { ...q, page: q.page + 1 };
    }
    const { total } = await api.datasets.total(all());
    expect(seen.size).toBe(total);
  });

  it("sorts, both ways", async () => {
    const asc = names((await api.datasets.list(all({ sort: "name", dir: "asc", pageSize: 25 }))).items);
    const desc = names((await api.datasets.list(all({ sort: "name", dir: "desc", pageSize: 25 }))).items);
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
    expect(desc).toEqual([...desc].sort((a, b) => b.localeCompare(a)));
  });

  it("filters by instrument", async () => {
    const { items } = await api.datasets.list(all({ instruments: ["loki"], pageSize: 100 }));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((d) => d.instrumentIds.includes("loki"))).toBe(true);
  });

  it("filters by technique", async () => {
    const { items } = await api.datasets.list(all({ techniques: ["SANS"], pageSize: 100 }));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((d) => d.techniques.some((t) => t.name === "SANS"))).toBe(true);
  });

  it("filters by type", async () => {
    const { items } = await api.datasets.list(all({ types: ["derived"], pageSize: 100 }));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((d) => d.type === "derived")).toBe(true);
  });

  it("filters by a date range", async () => {
    const { items } = await api.datasets.list(all({ from: "2026-07-01", to: "2026-07-31", pageSize: 100 }));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((d) => d.creationTime >= "2026-07-01" && d.creationTime < "2026-08-01")).toBe(true);
  });

  it("every word of the text has to match", async () => {
    const [first] = (await api.datasets.list(all({ pageSize: 1 }))).items;
    const hit = await api.datasets.list(all({ q: first.datasetName }));
    expect(hit.items.map((d) => d.pid)).toContain(first.pid);
    const miss = await api.datasets.list(all({ q: `${first.datasetName} zzzznothing` }));
    expect(miss.items).toHaveLength(0);
  });

  it("combines filters: both have to hold", async () => {
    const { items } = await api.datasets.list(all({ instruments: ["loki"], types: ["derived"], pageSize: 100 }));
    expect(items.every((d) => d.instrumentIds.includes("loki") && d.type === "derived")).toBe(true);
  });

  it("counts what matches, stopping at the cap", async () => {
    const t = await api.datasets.total(all());
    expect(t.capped).toBe(false);
    const capped = await api.datasets.total(all(), undefined, 5);
    expect(capped).toEqual({ total: 5, capped: true });
  });

  it("finds datasets by what people type in the search box", async () => {
    const [d] = (await api.datasets.list(all({ pageSize: 1 }))).items;
    const found = await api.datasets.search(d.datasetName, 6);
    expect(found.map((x) => x.pid)).toContain(d.pid);
    expect(found.length).toBeLessThanOrEqual(6);
  });
});

run("who can see what", () => {
  it("a user sees their groups' datasets under 'mine', the administrator everything under 'all'", async () => {
    await signIn("admin@example.org");
    const everything = (await api.datasets.total(all())).total;
    await signIn("ada.okafor@example.org");
    const mine = await api.datasets.list({ ...DEFAULT_QUERY, scope: "mine", pageSize: 100 });
    expect(mine.items.length).toBeGreaterThan(0);
    expect(mine.items.every((d) => ["bio-sax", "ada-lab"].includes(d.ownerGroup))).toBe(true);
    expect((await api.datasets.total({ ...DEFAULT_QUERY, scope: "mine" })).total).toBeLessThan(everything);
  });

  it("'public' is only what has been published", async () => {
    await signIn("henrik.nilsson@example.org");
    const { items } = await api.datasets.list({ ...DEFAULT_QUERY, scope: "public", pageSize: 100 });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((d) => d.isPublished)).toBe(true);
  });
});

run("one dataset", () => {
  beforeAll(() => signIn("admin@example.org"));

  it("is read by its pid, and an unknown pid is an error, not an empty record", async () => {
    const [d] = (await api.datasets.list(all({ pageSize: 1 }))).items;
    expect((await api.datasets.get(d.pid)).pid).toBe(d.pid);
    await expect(api.datasets.get("no-such-dataset")).rejects.toThrow();
  });

  it("knows what it was derived from and what was derived from it, consistently", async () => {
    const { items } = await api.datasets.list(all({ types: ["derived"], pageSize: 5 }));
    for (const d of items) {
      const rel = await api.datasets.related(d.pid);
      expect(rel.sources.map((s) => s.pid)).toEqual(d.inputDatasets);
      expect(rel.sources.every((s) => s.type === "raw" || s.inputDatasets.length > 0)).toBe(true);
      for (const src of rel.sources) {
        const back = await api.datasets.related(src.pid);
        expect(back.derived.map((x) => x.pid)).toContain(d.pid);
      }
    }
  });

  it("lists its files", async () => {
    const [d] = (await api.datasets.list(all({ pageSize: 1 }))).items;
    const { files, total } = await api.datasets.files(d.pid);
    expect(files.length).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
  });

  it("serves the measurement dictionary a page at a time, most used first", async () => {
    const { items, total } = await api.datasets.metaKeys({ limit: 5 });
    expect(items.length).toBeLessThanOrEqual(5);
    expect(total).toBeGreaterThanOrEqual(items.length);
    const counts = items.map((k) => k.usageCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    const excluded = await api.datasets.metaKeys({ limit: 5, exclude: [items[0].key] });
    expect(excluded.items.map((k) => k.key)).not.toContain(items[0].key);
  });
});

run("changing data", () => {
  it("an administrator edits a dataset and the change is in its history", async () => {
    await signIn("admin@example.org");
    const [d] = (await api.datasets.list(all({ pageSize: 1 }))).items;
    const before = d.history.length;
    const next = await api.datasets.update(d.pid, { datasetName: "Renamed run", keywords: ["a", "b"] }, "Renamed in a test");
    expect(next).toMatchObject({ datasetName: "Renamed run", keywords: ["a", "b"] });
    expect((await api.datasets.get(d.pid)).history.length).toBe(before + 1);
    await api.datasets.update(d.pid, { datasetName: d.datasetName, keywords: d.keywords });
  });

  it("a user cannot change a dataset of a group they are not in, whatever the screen offers", async () => {
    await signIn("admin@example.org");
    const other = (await api.datasets.list(all({ pageSize: 100 }))).items.find((d) => d.ownerGroup === "facility-admin" || !["bio-sax", "ada-lab"].includes(d.ownerGroup))!;
    await signIn("ada.okafor@example.org");
    await expect(api.datasets.update(other.pid, { description: "x" })).rejects.toThrow(/permission/i);
    await expect(api.datasets.remove(other.pid)).rejects.toThrow(/permission/i);
  });

  it("only an administrator creates a dataset", async () => {
    const input = { name: "New run", type: "raw" as const, proposalId: "20240311", instrumentId: "loki", description: "d", keywords: ["k"], metadata: [{ key: "temperature", value: "20", unit: "K" }], sourceFolder: "", fileCount: 3, bytes: 1000 };
    await signIn("ada.okafor@example.org");
    await expect(api.datasets.create(input)).rejects.toThrow(/administrator/i);
    await signIn("admin@example.org");
    const made = await api.datasets.create(input);
    expect(made).toMatchObject({ datasetName: "New run", type: "raw", instrumentIds: ["loki"] });
    expect(made.scientificMetadata.temperature).toMatchObject({ value: 20, unit: "K" });
    expect((await api.datasets.get(made.pid)).pid).toBe(made.pid);
  });

  it("a removed dataset is gone, and restoring brings it back", async () => {
    await signIn("admin@example.org");
    const [d] = (await api.datasets.list(all({ sort: "name", dir: "desc", pageSize: 1 }))).items;
    const before = (await api.datasets.total(all())).total;
    const gone = await api.datasets.remove(d.pid);
    expect(gone.pid).toBe(d.pid);
    expect((await api.datasets.total(all())).total).toBe(before - 1);
    await api.datasets.restore(gone);
    expect((await api.datasets.total(all())).total).toBe(before);
  });

  it("publishing makes a dataset public", async () => {
    await signIn("admin@example.org");
    const d = (await api.datasets.list(all({ pageSize: 100 }))).items.find((x) => !x.isPublished)!;
    expect((await api.datasets.publish(d.pid)).isPublished).toBe(true);
  });
});

run("attachments", () => {
  const file = (name: string, body: string) => ({ fileName: name, mimeType: "text/plain", size: body.length, dataUrl: textToDataUrl(body) });
  let pid = "";
  beforeAll(async () => {
    await signIn("admin@example.org");
    // a seeded dataset: one created a moment ago by another test has no attachments yet
    pid = (await api.datasets.list(all({ pageSize: 100 }))).items.find((d) => d.createdBy === "ingestor")!.pid;
  });
  afterAll(() => api.auth.signOut());

  it("every dataset comes with attachments, and one of them stands for it", async () => {
    const list = await api.attachments.list(pid);
    expect(list.length).toBeGreaterThan(0);
    expect(list.map((a) => a.id)).toContain((await api.datasets.get(pid)).thumbnailAttachmentId);
  });

  it("attaches a file, and refuses the same content again under any name", async () => {
    const [made] = await api.attachments.add(pid, [file("notes.txt", "contract test")]);
    expect(made).toMatchObject({ datasetId: pid, fileName: "notes.txt" });
    await expect(api.attachments.add(pid, [file("notes.txt", "contract test")])).rejects.toThrow(/already attached\./);
    await expect(api.attachments.add(pid, [file("copy.txt", "contract test")])).rejects.toThrow(/already attached as notes\.txt/);
    expect((await api.attachments.add(pid, [file("copy.txt", "different")])).length).toBe(1);
  });

  it("also refuses two identical files sent together", async () => {
    await expect(api.attachments.add(pid, [file("a.txt", "twin"), file("b.txt", "twin")])).rejects.toThrow(/already attached/);
  });

  it("the same content may be attached to another dataset", async () => {
    const other = (await api.datasets.list(all({ pageSize: 2 }))).items[1].pid;
    expect((await api.attachments.add(other, [file("notes.txt", "contract test")])).length).toBe(1);
  });

  it("edits a caption, picks and clears the dataset's picture, and removes", async () => {
    const [a] = await api.attachments.add(pid, [file("picked.txt", "to pick")]);
    expect((await api.attachments.update(a.id, { caption: "A caption" })).caption).toBe("A caption");
    expect((await api.attachments.setThumbnail(pid, a.id)).thumbnailAttachmentId).toBe(a.id);
    expect((await api.attachments.setThumbnail(pid, null)).thumbnailAttachmentId).toBeFalsy();
    await api.attachments.remove(a.id);
    expect((await api.attachments.list(pid)).map((x) => x.id)).not.toContain(a.id);
  });

  it("a user cannot attach to a dataset of another group", async () => {
    const other = (await api.datasets.list(all({ pageSize: 100 }))).items.find((d) => !["bio-sax", "ada-lab"].includes(d.ownerGroup))!;
    await signIn("ada.okafor@example.org");
    await expect(api.attachments.add(other.pid, [file("x.txt", "nope")])).rejects.toThrow(/permission/i);
  });
});

run("proposals, samples, instruments, published data and jobs", () => {
  beforeAll(() => signIn("admin@example.org"));

  it("an experiment knows its proposal, and a proposal its experiments", async () => {
    const list = await api.proposals.list();
    const experiment = list.find((p) => p.type === "Experiment")!;
    const detail = await api.proposals.get(experiment.proposalId);
    expect(detail.parent?.proposalId).toBe(experiment.parentProposalId);
    const parent = await api.proposals.get(experiment.parentProposalId!);
    expect(parent.experiments.map((e) => e.proposalId)).toContain(experiment.proposalId);
  });

  it("each proposal's dataset count matches its datasets", async () => {
    const p = (await api.proposals.list()).find((x) => x.datasetCount > 0)!;
    const total = (await api.datasets.total(all({ proposals: [p.proposalId] }))).total;
    expect(total).toBe(p.datasetCount);
  });

  it("lists samples and instruments with how much data each holds", async () => {
    expect((await api.samples.list()).every((s) => s.datasetCount >= 0)).toBe(true);
    const detail = await api.samples.get((await api.samples.list())[0].sampleId);
    expect(detail.sample.sampleId).toBeTruthy();
    expect((await api.instruments.list()).length).toBeGreaterThan(5);
  });

  it("lists published data", async () => {
    const pubs = await api.published.list();
    expect(pubs.length).toBeGreaterThan(0);
  });

  it("retrieval and download requests become jobs, and a failed job can be retried", async () => {
    const [d] = (await api.datasets.list(all({ pageSize: 1 }))).items;
    const before = (await api.jobs.list()).length;
    const job = await api.datasets.requestDownload([d.pid]);
    expect(job.statusCode).toBeTruthy();
    expect((await api.jobs.list()).length).toBe(before + 1);
    const failed = (await api.jobs.list()).find((j) => /unsuccess|fail/i.test(j.statusCode))!;
    await expect(api.jobs.retry(failed.id)).resolves.not.toThrow();
  });
});

run("the dictionaries the screens read while rendering", () => {
  it("offer an administrator every proposal (to create a dataset in), and a user only their groups'", async () => {
    await signIn("admin@example.org");
    const everything = api.options.proposals();
    expect(everything.length).toBe((await api.proposals.list()).length);
    await signIn("ada.okafor@example.org");
    const hers = api.options.proposals();
    expect(hers.length).toBeGreaterThan(0);
    expect(hers.length).toBeLessThan(everything.length);
    expect(hers.every((p) => ["bio-sax", "ada-lab"].includes(p.ownerGroup))).toBe(true);
  });

  it("name an instrument or technique from its id", async () => {
    await api.ready;
    expect(api.options.label("instruments", "loki")).toBe("LoKI");
    expect(api.options.facetValues("instruments").length).toBeGreaterThan(5);
    expect(api.options.facetValues("techniques").map((o) => o.value)).toContain("SANS");
  });

  it("find keywords from a few letters", async () => {
    const { items } = await api.options.searchKeywords("sa", 5);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((k) => k.label.toLowerCase().includes("sa") || k.value.toLowerCase().includes("sa"))).toBe(true);
  });
});
