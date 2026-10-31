import { ART_OF, INSTRUMENTS, attachments, nextAttachmentId, PROPOSALS, SAMPLES, THUMB_OF, datasets, jobs, lifecycleFor, makeEvent, nextJobId, published, setStorage } from "./db";
import { canCreateDatasets, canManage, isAdmin, user } from "./session";
import { mockAuth } from "./auth";
import { emitChanged, emitJobDone } from "@/lib/bus";
import { fmtDate } from "@/lib/format";
import { toSI, unitInfo } from "@/lib/units";
import { combine, matchValues } from "@/lib/query";
import { makeThumbnail } from "@/lib/attachments";
import type { CatalogApi, CreateInput } from "@/api/types";
import type { SeedDataset } from "./types";
import {Dataset, DatasetQuery, FacetField, FacetOption, FileEntry, FilterGroup, Instrument, Job, JobKind, MetaCond, MetaKeyInfo, Proposal, PublishedData, Sample, Scope, Storage, storageOf, techniqueNames} from "@/types";

// the pretend network delay; tests run without it
const TESTING = import.meta.env.MODE === "test";
const sleep = (ms: number) => (TESTING ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
// a fast backend answers in well under a second
const lag = () => sleep(50 + Math.random() * 70);

// cancellable delay for the bounded result count
const slowLag = (min: number, spread: number, signal?: AbortSignal) =>
  TESTING ? Promise.resolve() : new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, min + Math.random() * spread);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

const isMine = (d: Dataset) => user.groups.includes(d.ownerGroup);
const inScope = (d: Dataset, s: Scope) => {
  // an administrator can reach every dataset
  if (isAdmin() && s === "all") return true;
  const mine = isMine(d);
  const shared = !mine && d.sharedWith.some((g) => user.groups.includes(g));
  if (s === "mine") return mine;
  if (s === "shared") return shared;
  if (s === "public") return d.isPublished;
  return mine || shared || d.isPublished;
};

function condOk(d: Dataset, c: MetaCond): boolean {
  const m = d.scientificMetadata[c.key];
  if (!m) return false;
  let v = m.value;
  let a = parseFloat(c.value);
  let b = parseFloat(c.value2 ?? "");
  if (typeof v !== "number") return String(v).toLowerCase().includes(c.value.toLowerCase());
  if (Number.isNaN(a) && (c.op !== "between" || Number.isNaN(b))) return true;
  if (c.unit && m.unit && c.unit !== m.unit) {
    // different units only match when they measure the same thing, compared in SI
    const from = toSI(v, m.unit);
    const to = unitInfo(c.unit);
    if (!from || !to || from.dim !== to.dim) return false;
    v = from.value;
    a = to.si(a);
    b = to.si(b);
  }
  if (c.op === "eq") return Math.abs(v - a) <= Math.max(Math.abs(a) * 0.01, 1e-6);
  if (c.op === "gt") return v > a;
  if (c.op === "lt") return v < a;
  // "between" with one side empty is a one-sided bound
  if (Number.isNaN(a)) return v <= b;
  if (Number.isNaN(b)) return v >= a;
  return v >= Math.min(a, b) && v <= Math.max(a, b);
}

function matches(d: Dataset, q: DatasetQuery): boolean {
  if (q.q.trim()) {
    const hay = [d.datasetName, d.pid, d.runNumber, d.description, d.keywords.join(" "), d.sampleName, d.proposalTitle, d.proposalId, d.instrumentName, d.owner, d.techniques.join(" ")].join(" ").toLowerCase();
    if (!q.q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t))) return false;
  }
  // every active group is a term; the connectors chosen in the chips row combine them
  const day = d.creationTime.slice(0, 10);
  const terms: { group: FilterGroup; ok: boolean }[] = [];
  if (q.types.length) terms.push({ group: "types", ok: q.types.includes(d.type) });
  if (q.instruments.length) terms.push({ group: "instruments", ok: matchValues(q.instruments, q.and.instruments, (i) => d.instrumentIds.includes(i)) });
  if (q.techniques.length) terms.push({ group: "techniques", ok: matchValues(q.techniques, q.and.techniques, (t) => techniqueNames(d).includes(t)) });
  if (q.proposals.length) terms.push({ group: "proposals", ok: matchValues(q.proposals, q.and.proposals, (p) => d.proposalIds.includes(p)) });
  if (q.keywords.length) terms.push({ group: "keywords", ok: matchValues(q.keywords, q.and.keywords, (k) => d.keywords.includes(k)) });
  if (q.storage.length) terms.push({ group: "storage", ok: q.storage.includes(storageOf(d)) });
  if (q.from || q.to) terms.push({ group: "date", ok: !(q.from && day < q.from) && !(q.to && day > q.to) });
  if (q.conds.length) terms.push({ group: "conds", ok: q.conds.every((c) => condOk(d, c)) });
  return combine(terms, q.orBefore);
}

const STORAGE_LABEL: Record<Storage, string> = { online: "On disk", archived: "Archived", retrieving: "Retrieving" };

export function labelFor(field: FacetField, v: string): string {
  if (field === "instruments") return INSTRUMENTS.find((i) => i.pid === v)?.name ?? v;
  if (field === "proposals") return v;
  if (field === "types") return v === "raw" ? "Raw" : "Derived";
  if (field === "storage") return STORAGE_LABEL[v as Storage] ?? v;
  return v;
}

// The values a filter can offer. They come from small dictionaries, not from counting datasets,
// so the filter appears at once and never waits on the catalog.
const isMyProposal = (p: Proposal) => user.groups.includes(p.ownerGroup);

export function facetOptions(field: FacetField): FacetOption[] {
  const byLabel = (a: FacetOption, b: FacetOption) => a.label.localeCompare(b.label);
  switch (field) {
    case "instruments":
      return INSTRUMENTS.map((i) => ({ value: i.pid, label: i.name })).sort(byLabel);
    case "types":
      return [{ value: "raw", label: "Raw" }, { value: "derived", label: "Derived" }];
    case "storage":
      return [{ value: "online", label: STORAGE_LABEL.online }, { value: "archived", label: STORAGE_LABEL.archived }];
    case "techniques":
      return [...new Set(INSTRUMENTS.flatMap((i) => i.techniques))].sort().map((t) => ({ value: t, label: t }));
    case "proposals":
      // the searcher's own proposals first, newest first within each group
      return [...PROPOSALS]
        .sort((a, b) => Number(isMyProposal(b)) - Number(isMyProposal(a)) || b.startTime.localeCompare(a.startTime))
        .map((p) => ({ value: p.proposalId, label: p.proposalId, hint: fmtDate(p.startTime) }));
    case "keywords":
      return keywordList();
  }
}

// Keyword dictionary (term → dataset count) maintained on every write, so reading it never scans datasets.
const KEYWORDS = new Map<string, number>();
let keywordCache: FacetOption[] | null = null;
// Stands in for the metadataKeys collection: built here from the seed, a real backend keeps it as an index.
function metaIndex(): MetaKeyInfo[] {
  const map = new Map<string, number>();
  for (const d of datasets) {
    if (!inScope(d, "all")) continue;
    for (const key of Object.keys(d.scientificMetadata)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map].map(([key, usageCount]) => ({ key, humanReadableName: "", usageCount })).sort((a, b) => b.usageCount - a.usageCount);
}

function trackKeywords(before: string[], after: string[]) {
  for (const k of before) KEYWORDS.set(k, (KEYWORDS.get(k) ?? 1) - 1);
  for (const k of after) KEYWORDS.set(k, (KEYWORDS.get(k) ?? 0) + 1);
  for (const [k, n] of KEYWORDS) if (n <= 0) KEYWORDS.delete(k);
  keywordCache = null;
}
for (const d of datasets) if (inScope(d, "all")) trackKeywords([], d.keywords);
const keywordList = () =>
  (keywordCache ??= [...KEYWORDS].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => ({ value: k, label: k })));

// Find-as-you-type over the keyword dictionary: most used first when empty, prefix matches before substring matches.
export function searchKeywords(text: string, limit = 8): { items: FacetOption[] } {
  const t = text.trim().toLowerCase();
  const pool = keywordList();
  const hits = t ? pool.filter((o) => o.label.toLowerCase().includes(t)) : pool;
  const ranked = t ? [...hits.filter((o) => o.label.toLowerCase().startsWith(t)), ...hits.filter((o) => !o.label.toLowerCase().startsWith(t))] : hits;
  return { items: ranked.slice(0, limit) };
}

function simulate(job: Job, ms: number, onDone?: () => void) {
  const step = 250;
  const timer = setInterval(() => {
    job.statusCode = "inProgress";
    job.progress = Math.min(100, job.progress + (100 * step) / ms + Math.random() * 3);
    if (job.progress >= 100) {
      clearInterval(timer);
      job.progress = 100;
      job.statusCode = "finishedSuccessful";
      onDone?.();
      emitJobDone(job);
    }
  }, step);
}

function newJob(kind: JobKind, sets: Dataset[], message?: string): Job {
  const at = new Date().toISOString();
  const job: Job = {
    id: nextJobId(), type: kind, statusCode: "jobSubmitted", statusMessage: message ?? "",
    ownerUser: user.email, ownerGroup: user.groups[0], contactEmail: user.email,
    jobParams: { datasetList: sets.map((s) => ({ pid: s.pid, files: [] })) }, configVersion: "v1.0.0", jobResultObject: {},
    createdAt: at, updatedAt: at, progress: 0, datasetNames: sets.map((s) => s.datasetName), bytes: sets.reduce((a, s) => a + s.size, 0),
  };
  jobs.unshift(job);
  return job;
}

function prng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a content hash of a data URL, cached: the seeded pictures are drawn on first use and are not small
const hashes = new Map<string, string>();
async function contentHash(dataUrl: string): Promise<string> {
  const key = dataUrl.length > 4096 ? `${dataUrl.length}:${dataUrl.slice(0, 2048)}:${dataUrl.slice(-2048)}` : dataUrl;
  let h = hashes.get(key);
  if (!h) {
    const bytes = new TextEncoder().encode(dataUrl);
    h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
    hashes.set(key, h);
  }
  return h;
}

function genFiles(d: SeedDataset): { files: FileEntry[]; total: number } {
  const r = prng(d.thumbSeed ?? 1);
  const t0 = new Date(d.creationTime).getTime();
  const tech = d.techniques[0]?.name;
  const avg = d.size / Math.max(1, d.numberOfFiles);
  const files: FileEntry[] = [];
  const add = (path: string, size: number, kind: FileEntry["kind"], k: number) =>
    files.push({ path, size: Math.round(size), kind, modified: new Date(Math.min(t0 + k * 45000, Date.now())).toISOString() });
  add("README.md", 1180, "text", 0);
  add("metadata.json", 9400 + Math.round(r() * 3000), "text", 0);
  const shown = Math.min(d.numberOfFiles, 32);
  for (let i = 1; i <= shown; i++) {
    const n = String(i).padStart(4, "0");
    const sz = avg * (0.7 + r() * 0.6);
    if (tech === "MX") add(`images/${d.datasetName}_${n}.cbf`, sz, "image", i);
    else if (tech === "Cryo-EM") add(`movies/FoilHole_${10000 + i * 7}_Data_${n}.tiff`, sz, "image", i);
    else add(`raw/${d.datasetName}_${n}.h5`, sz, "data", i);
  }
  if (tech === "MX") add("process/XDS_ASCII.HKL", 48e6, "data", 40);
  else if (tech === "Cryo-EM") add("motioncor/summed_micrographs.mrcs", 2.1e9, "data", 40);
  else add("processed/azimuthal_integration.dat", 5.2e6, "data", 40);
  add("preview/preview.png", 410e3, "image", 41);
  add("logs/acquisition.log", 220e3, "text", 41);
  return { files, total: d.numberOfFiles + 4 };
}


let pidSeq = datasets.length;

// The in-memory adapter: everything the UI needs, computed from the seed in src/data/db.ts with a little latency.
export const mockApi: CatalogApi = {
  datasets: {
    async list(q: DatasetQuery) {
      await lag();
      const universe = datasets.filter((d) => inScope(d, q.scope));
      const filtered = universe.filter((d) => matches(d, q));
      const dir = q.dir === "asc" ? 1 : -1;
      const sorted = [...filtered].sort((a, b) => {
        if (q.sort === "runNumber") return (Number(a.runNumber) - Number(b.runNumber)) * dir;
        const key = q.sort === "name" ? "datasetName" : q.sort;
        const x = a[key];
        const y = b[key];
        return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * dir;
      });
      // like the real list endpoint: rows only, plus whether another page exists. The count is a separate, bounded call.
      const start = (q.page - 1) * q.pageSize;
      const rows = sorted.slice(start, start + q.pageSize + 1);
      return { items: rows.slice(0, q.pageSize), hasMore: rows.length > q.pageSize };
    },
    // the only count left: how many results match, stopping at `cap` so its cost stays bounded
    async total(q: DatasetQuery, signal?: AbortSignal, cap = 10000): Promise<{ total: number; capped: boolean }> {
      await slowLag(30, 40, signal);
      const n = datasets.filter((d) => inScope(d, q.scope) && matches(d, q)).length;
      return { total: Math.min(n, cap), capped: n > cap };
    },
    async search(text: string, limit = 6): Promise<Dataset[]> {
      await sleep(90);
      const toks = text.toLowerCase().split(/\s+/).filter(Boolean);
      return datasets
        .filter((d) => inScope(d, "all"))
        .filter((d) => {
          const hay = `${d.datasetName} ${d.pid} ${d.keywords.join(" ")} ${d.sampleName}`.toLowerCase();
          return toks.every((t) => hay.includes(t));
        })
        .sort((a, b) => Number(b.datasetName.toLowerCase().startsWith(toks[0])) - Number(a.datasetName.toLowerCase().startsWith(toks[0])) || b.creationTime.localeCompare(a.creationTime))
        .slice(0, limit);
    },
    async get(pid: string): Promise<Dataset> {
      await lag();
      const d = datasets.find((x) => x.pid === pid);
      if (!d) throw new Error("This dataset doesn't exist or has been removed.");
      if (!inScope(d, "all")) throw new Error("You don't have access to this dataset. Ask the owner to share it with you.");
      // a copy, as a real API answers with a fresh document each time (the page compares by value)
      return { ...d };
    },
    async related(pid: string) {
      await sleep(120);
      const d = datasets.find((x) => x.pid === pid)!;
      return {
        sources: d.inputDatasets.map((p) => datasets.find((x) => x.pid === p)).filter(Boolean) as Dataset[],
        derived: datasets.filter((x) => x.inputDatasets.includes(pid) && inScope(x, "all")),
        siblings: datasets.filter((x) => x.proposalId === d.proposalId && x.pid !== pid && inScope(x, "all")).slice(0, 4),
      };
    },
    async files(pid: string) {
      await lag();
      return genFiles(datasets.find((x) => x.pid === pid)!);
    },
    async metaKeys({ text = "", limit = 8, exclude = [] }): Promise<{ items: MetaKeyInfo[]; total: number }> {
      await sleep(80);
      const t = text.trim().toLowerCase().replace(/[\s_]+/g, " ");
      const name = (k: MetaKeyInfo) => `${k.humanReadableName} ${k.key}`.toLowerCase().replace(/_/g, " ");
      const hits = metaIndex().filter((k) => !exclude.includes(k.key) && (!t || name(k).includes(t)));
      // names that start with the text come first
      if (t) hits.sort((a, b) => Number(b.key.toLowerCase().replace(/_/g, " ").startsWith(t)) - Number(a.key.toLowerCase().replace(/_/g, " ").startsWith(t)) || b.usageCount - a.usageCount);
      return { items: hits.slice(0, limit), total: hits.length };
    },
    async update(pid: string, patch: Partial<Pick<Dataset, "description" | "keywords" | "sharedWith" | "datasetName">>, note = "Updated details"): Promise<Dataset> {
      await sleep(260);
      const d = datasets.find((x) => x.pid === pid)!;
      if (!canManage(d.ownerGroup)) throw new Error("You don't have permission to change this dataset.");
      if (patch.keywords) trackKeywords(d.keywords, patch.keywords);
      Object.assign(d, patch);
      d.history.push(makeEvent(new Date().toISOString(), "edited", user.name, note));
      d.updatedAt = new Date().toISOString();
      d.updatedBy = user.email;
      emitChanged();
      return { ...d };
    },
    async remove(pid: string): Promise<Dataset> {
      await sleep(200);
      const i = datasets.findIndex((x) => x.pid === pid);
      if (i >= 0 && !canManage(datasets[i].ownerGroup)) throw new Error("You don't have permission to delete this dataset.");
      const gone = datasets.splice(i, 1)[0];
      emitChanged();
      return gone;
    },
    async restore(d: Dataset) {
      datasets.push(d);
      emitChanged();
    },
    async create(input: CreateInput): Promise<Dataset> {
      await sleep(700);
      // the backend decides, whatever the UI offers
      if (!canCreateDatasets()) throw new Error("Only administrators can create datasets.");
      const inst = INSTRUMENTS.find((i) => i.pid === input.instrumentId)!;
      const prop = PROPOSALS.find((p) => p.proposalId === input.proposalId)!;
      const sample = SAMPLES.find((s) => s.sampleId === input.sampleId);
      const now = new Date().toISOString();
      trackKeywords([], input.keywords);
      const tech = inst.techniques[0];
      const d: SeedDataset = {
        pid: `MDC-${new Date().getFullYear() % 100}-${String(++pidSeq + 1000).padStart(5, "0")}`,
        datasetName: input.name, runNumber: input.runNumber ?? "", description: input.description, type: input.type,
        ownerGroup: user.groups[0], accessGroups: [prop.proposalId], instrumentGroup: inst.pid, isPublished: false,
        owner: user.name, ownerEmail: user.email, contactEmail: user.email, sharedWith: [],
        sourceFolder: input.sourceFolder || `/data/${user.groups[0]}/${prop.proposalId}/${input.name}`,
        size: input.bytes, packedSize: 0, numberOfFiles: input.fileCount, numberOfFilesArchived: 0,
        creationTime: now, startTime: now, endTime: now, creationLocation: `/Lund/ESS/${inst.name}`, dataFormat: "NeXus (HDF5)",
        keywords: input.keywords, license: "CC BY 4.0", classification: "IN=medium,AV=low,CO=low", version: "v4",
        datasetlifecycle: lifecycleFor("online", now),
        techniques: [{ pid: `technique:${tech.toLowerCase().replace(/[^a-z]+/g, "-")}`, name: tech }],
        principalInvestigators: [prop.pi], proposalIds: [prop.proposalId], sampleIds: sample ? [sample.sampleId] : [], instrumentIds: [inst.pid],
        inputDatasets: [], usedSoftware: [],
        scientificMetadata: Object.fromEntries(input.metadata.filter((m) => m.key.trim()).map((m) => [m.key.trim().replace(/\s+/g, "_"), { value: Number.isNaN(Number(m.value)) || m.value === "" ? m.value : Number(m.value), unit: m.unit || undefined, group: "Acquisition" }])),
        createdBy: user.email, updatedBy: user.email, createdAt: now, updatedAt: now,
        instrumentName: inst.name, proposalId: prop.proposalId, proposalTitle: prop.title, sampleId: sample?.sampleId ?? "", sampleName: sample?.sampleName ?? "—",
        thumbSeed: Math.floor(Math.random() * 99999), thumbStyle: THUMB_OF[tech] ?? ART_OF[inst.pid].style, thumbHue: ART_OF[inst.pid].hue,
        history: [makeEvent(now, "created", user.name, "Dataset record created")],
      };
      datasets.push(d);
      emitChanged();
      return d;
    },
    async publish(pid: string): Promise<Dataset> {
      await sleep(900);
      const d = datasets.find((x) => x.pid === pid)!;
      if (!canManage(d.ownerGroup)) throw new Error("You don't have permission to change this dataset.");
      const now = new Date().toISOString();
      d.isPublished = true;
      d.doi = `10.17199/${d.runNumber}-${d.pid.slice(-4)}`;
      d.validationStatus = "validated";
      d.datasetlifecycle = { ...d.datasetlifecycle, publishable: true, dateOfPublishing: now, publishedOn: now };
      d.history.push(makeEvent(now, "published", user.name, `Published with DOI ${d.doi}`));
      newJob("publish", [d], "DOI registered").statusCode = "finishedSuccessful";
      emitChanged();
      return { ...d };
    },
    async requestRetrieval(pid: string): Promise<Job> {
      await sleep(300);
      const d = datasets.find((x) => x.pid === pid)!;
      setStorage(d, "retrieving");
      const job = newJob("retrieve", [d], "Restoring from tape");
      emitChanged();
      simulate(job, 9000, () => {
        setStorage(d, "online");
        job.statusMessage = "Restored to online storage";
        d.history.push(makeEvent(new Date().toISOString(), "retrieved", "Archive service", "Retrieved from tape to online storage"));
      });
      return job;
    },
    async requestDownload(pids: string[]): Promise<Job> {
      await sleep(300);
      const job = newJob("download", datasets.filter((d) => pids.includes(d.pid)), "Preparing archive");
      simulate(job, 6000, () => (job.statusMessage = "Archive ready"));
      return job;
    },
  },
  auth: mockAuth,
  attachments: {
    async list(pid: string) {
      await lag();
      return attachments.filter((a) => a.datasetId === pid).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async add(pid: string, files: { fileName: string; mimeType: string; size: number; dataUrl: string; thumbnail?: string }[]) {
      await sleep(250);
      const d = datasets.find((x) => x.pid === pid)!;
      if (!canManage(d.ownerGroup)) throw new Error("You don't have permission to change this dataset.");
      // the same bytes are not attached twice, whatever the file is called (a real backend keeps a hash per attachment)
      const known = new Map<string, string>();
      for (const a of attachments) if (a.datasetId === pid) known.set(await contentHash(a.dataUrl), a.fileName);
      for (const f of files) {
        const h = await contentHash(f.dataUrl);
        const existing = known.get(h);
        if (existing) throw new Error(`${f.fileName} is already attached${existing === f.fileName ? "" : ` as ${existing}`}.`);
        known.set(h, f.fileName);
      }
      const now = new Date().toISOString();
      const made = files.map((f) => ({
        id: nextAttachmentId(), datasetId: pid, caption: "", thumbnail: f.thumbnail, ownerGroup: d.ownerGroup, accessGroups: d.accessGroups, isPublished: d.isPublished,
        createdBy: user.email, createdAt: now, updatedAt: now, fileName: f.fileName, mimeType: f.mimeType || "application/octet-stream", size: f.size, dataUrl: f.dataUrl,
      }));
      attachments.unshift(...made);
      const firstImage = made.find((m) => m.mimeType.startsWith("image/"));
      if (firstImage && !d.thumbnailAttachmentId) d.thumbnailAttachmentId = firstImage.id;
      d.history.push(makeEvent(now, "edited", user.name, `Attached ${made.length === 1 ? made[0].fileName : `${made.length} files`}`));
      emitChanged();
      return made;
    },
    async update(id: string, patch: { caption: string }) {
      await sleep(150);
      const a = attachments.find((x) => x.id === id)!;
      a.caption = patch.caption;
      a.updatedAt = new Date().toISOString();
      emitChanged();
      return a;
    },
    async remove(id: string) {
      await sleep(150);
      const i = attachments.findIndex((x) => x.id === id);
      if (i < 0) return;
      const [gone] = attachments.splice(i, 1);
      const d = datasets.find((x) => x.pid === gone.datasetId);
      if (d?.thumbnailAttachmentId === id) {
        d.thumbnailAttachmentId = undefined;
      }
      emitChanged();
    },
    async picture(id: string) {
      await sleep(10);
      const a = attachments.find((x) => x.id === id);
      if (!a) return undefined;
      if (a.thumbnail) return a.thumbnail;
      // an image stands for itself; any other file through a picture drawn for it (the first time it is asked for)
      if (a.mimeType.startsWith("image/")) return a.dataUrl;
      return (a.thumbnail = await makeThumbnail(a));
    },
    async setThumbnail(pid: string, id: string | null) {
      await sleep(150);
      const d = datasets.find((x) => x.pid === pid)!;
      const a = id ? attachments.find((x) => x.id === id) : undefined;
      d.thumbnailAttachmentId = a ? a.id : undefined;
      d.history.push(makeEvent(new Date().toISOString(), "edited", user.name, a ? `Thumbnail set from ${a.fileName}` : "Thumbnail reset"));
      emitChanged();
      return { ...d };
    },
  },
  proposals: {
    async list(): Promise<(Proposal & { datasetCount: number })[]> {
      await lag();
      return PROPOSALS.map((p) => ({ ...p, datasetCount: datasets.filter((d) => d.proposalId === p.proposalId && inScope(d, "all")).length })).sort((a, b) => b.startTime.localeCompare(a.startTime));
    },
    async get(id: string) {
      await lag();
      const p = PROPOSALS.find((x) => x.proposalId === id);
      if (!p) throw new Error("Proposal not found.");
      const sets = datasets.filter((d) => d.proposalId === id && inScope(d, "all"));
      const parent = p.parentProposalId ? PROPOSALS.find((x) => x.proposalId === p.parentProposalId) : undefined;
      const experiments = PROPOSALS.filter((x) => x.parentProposalId === p.proposalId).map((x) => ({ ...x, datasetCount: datasets.filter((d) => d.proposalId === x.proposalId && inScope(d, "all")).length }));
      return { proposal: p, parent, experiments, instruments: INSTRUMENTS.filter((i) => p.instrumentIds.includes(i.pid)), samples: SAMPLES.filter((s) => p.sampleIds.includes(s.sampleId)), datasetCount: sets.length, size: sets.reduce((a, d) => a + d.size, 0), recent: [...sets].sort((a, b) => b.creationTime.localeCompare(a.creationTime)).slice(0, 8) };
    },
  },
  samples: {
    async list(opts?: { conds?: MetaCond[] }): Promise<(Sample & { datasetCount: number; instrumentIds: string[]; techniques: string[] })[]> {
      await lag();
      const conds = opts?.conds ?? [];
      return SAMPLES.filter((s) => !conds.length || datasets.some((d) => d.sampleId === s.sampleId && conds.every((c) => condOk(d, c)))).map((s) => {
        const sets = datasets.filter((d) => d.sampleId === s.sampleId && inScope(d, "all"));
        return { ...s, datasetCount: sets.length, instrumentIds: [...new Set(sets.flatMap((d) => d.instrumentIds))], techniques: [...new Set(sets.flatMap((d) => techniqueNames(d)))].sort() };
      });
    },
    async get(id: string) {
      await lag();
      const sample = SAMPLES.find((x) => x.sampleId === id);
      if (!sample) throw new Error("Sample not found.");
      const sets = datasets.filter((d) => d.sampleId === id && inScope(d, "all"));
      return {
        sample,
        datasetCount: sets.length,
        size: sets.reduce((a, d) => a + d.size, 0),
        proposals: PROPOSALS.filter((p) => p.sampleIds.includes(id)),
        instruments: INSTRUMENTS.filter((i) => sets.some((d) => d.instrumentIds.includes(i.pid))),
        techniques: [...new Set(sets.flatMap((d) => techniqueNames(d)))].sort(),
        recent: [...sets].sort((a, b) => b.creationTime.localeCompare(a.creationTime)).slice(0, 8),
      };
    },
  },
  instruments: {
    async list(): Promise<(Instrument & { datasetCount: number; lastRun?: string })[]> {
      await lag();
      return INSTRUMENTS.map((i) => {
        const sets = datasets.filter((d) => d.instrumentIds.includes(i.pid) && inScope(d, "all"));
        return { ...i, datasetCount: sets.length, lastRun: sets.map((d) => d.creationTime).sort().pop() };
      });
    },
  },
  published: {
    async list(): Promise<PublishedData[]> {
      await lag();
      return published;
    },
    async get(pid: string) {
      await lag();
      const p = published.find((x) => x.pid === pid || x.doi === pid);
      if (!p) throw new Error("Publication not found.");
      return { published: p, datasets: datasets.filter((d) => p.datasetPids.includes(d.pid)) };
    },
  },
  jobs: {
    async list(): Promise<Job[]> {
      await sleep(80);
      return jobs.map((j) => ({ ...j }));
    },
    async retry(id: string) {
      await sleep(200);
      const j = jobs.find((x) => x.id === id)!;
      j.statusCode = "jobCreated";
      j.progress = 0;
      j.statusMessage = "Retrying";
      simulate(j, 5000, () => (j.statusMessage = "Completed on retry"));
    },
  },
  options: {
    label: labelFor,
    facetValues: facetOptions,
    searchKeywords: async (text: string, limit?: number) => (await sleep(30), searchKeywords(text, limit)),
    // an administrator reaches every proposal; everyone else only their groups'
    proposals: () => PROPOSALS.filter((p) => isAdmin() || user.groups.includes(p.ownerGroup)),
    instruments: () => INSTRUMENTS,
    samples: () => SAMPLES,
  },
  ready: Promise.resolve(),
};
