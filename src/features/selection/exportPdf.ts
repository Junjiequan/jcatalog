import { api } from "@/api";
import { fmtBytes, fmtDate, fmtNum, plural } from "@/lib/format";
import { humanizeStatus } from "@/lib/jobs";
import { KIND_LABEL, byKind, type SelItem } from "@/store/selection";
import {proposalKind, type Dataset, storageOf, proposerName, techniqueNames} from "@/types";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const bare = (id: string) => id.replace(/^[a-z]+:/, "");
const JOB_KIND: Record<string, string> = { retrieve: "Retrieve from tape", download: "Download", archive: "Archive", publish: "Publish" };

// a label/value list; empty values are skipped
const dl = (rows: [string, unknown][]) =>
  `<dl>${rows.filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${Array.isArray(v) ? esc(v.join(", ")) : esc(v)}</dd></div>`).join("")}</dl>`;
const para = (label: string, text?: string) => (text ? `<h4>${esc(label)}</h4><p>${esc(text)}</p>` : "");
const table = (head: string[], rows: unknown[][]) => (rows.length ? `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "");

const datasetBlock = (d: Dataset) => `
  <article>
    <h3>${esc(d.datasetName)}</h3>
    ${dl([
      ["PID", d.pid], ["Run number", d.runNumber], ["Type", d.type], ["Instrument", d.instrumentName], ["Proposal", `${d.proposalId} · ${d.proposalTitle}`],
      ["Sample", d.sampleName], ["Techniques", techniqueNames(d)], ["Created", fmtDate(d.creationTime, true)], ["Owner", `${d.owner} (${d.ownerGroup})`],
      ["Size", `${fmtBytes(d.size)} · ${plural(d.numberOfFiles, "file")}`], ["Availability", storageOf(d) === "archived" ? "Archived" : "On disk"], ["Published", d.isPublished ? d.doi ?? "yes" : "no"],
      ["Keywords", d.keywords], ["Source folder", d.sourceFolder],
    ])}
    ${para("Description", d.description)}
    ${Object.keys(d.scientificMetadata).length ? `<h4>Scientific metadata</h4>${table(["Property", "Value", "Unit"], Object.entries(d.scientificMetadata).map(([k, m]) => [k, m.value, m.unit ?? ""]))}` : ""}
  </article>`;

async function block(i: SelItem): Promise<string> {
  switch (i.kind) {
    case "dataset":
      return datasetBlock(await api.datasets.get(i.id));
    case "proposal":
    case "experiment": {
      const { proposal: p, parent, experiments, instruments, samples, datasetCount, size } = await api.proposals.get(bare(i.id));
      const inst = (id: string) => instruments.find((x) => x.pid === id)?.name ?? id;
      return `<article><h3>${esc(p.title)}</h3>${dl([
        ["Kind", proposalKind(p) === "experiment" ? "Experiment" : "Proposal"], ["Type", p.type], ["Number", p.proposalId], ["Part of proposal", parent && `${parent.proposalId} · ${parent.title}`],
        ["Principal investigator", `${p.pi} · ${p.pi_email}`], ["Proposer", `${proposerName(p)} · ${p.email}`], ["Owner group", p.ownerGroup], ["Access groups", p.accessGroups], ["Team", p.team],
        ["Period", `${fmtDate(p.startTime)} – ${fmtDate(p.endTime)}`], ["Instruments", instruments.map((x) => `${x.name} (${x.title})`)], ["Samples", samples.map((x) => x.sampleName)],
        ["Experiments", experiments.map((x) => `${x.proposalId} · ${x.title}`)], ["Datasets", `${fmtNum(datasetCount)} · ${fmtBytes(size)}`], ["Published", p.isPublished ? "yes" : "no"],
        ["Created", `${fmtDate(p.createdAt, true)} by ${p.createdBy}`], ["Updated", `${fmtDate(p.updatedAt, true)} by ${p.updatedBy}`],
      ])}${para("Abstract", p.abstract)}
        ${p.MeasurementPeriodList.length ? `<h4>Measurement periods</h4>${table(["Instrument", "From", "To"], p.MeasurementPeriodList.map((m) => [inst(m.instrument), fmtDate(m.start), fmtDate(m.end)]))}` : ""}
        ${Object.keys(p.metadata).length ? `<h4>Metadata</h4>${dl(Object.entries(p.metadata))}` : ""}</article>`;
    }
    case "sample": {
      const { sample: s, datasetCount, size, proposals, instruments, techniques } = await api.samples.get(bare(i.id));
      const groups = Object.entries(s.groups ?? {}).map(([g, kv]) => `<h4>${esc(g)}</h4>${dl(Object.entries(kv))}`).join("");
      return `<article><h3>${esc(s.sampleName)}</h3>${dl([["Formula", s.formula], ["Owner", s.owner], ["Proposals", proposals.map((p) => `${p.proposalId} · ${p.title}`)], ["Instruments", instruments.map((x) => x.name)], ["Techniques", techniques], ["Datasets", `${fmtNum(datasetCount)} · ${fmtBytes(size)}`]])}
        ${para("Description", s.description)}${Object.keys(s.sampleCharacteristics).length ? `<h4>Characteristics</h4>${dl(Object.entries(s.sampleCharacteristics))}` : ""}${groups}</article>`;
    }
    case "instrument": {
      const x = (await api.instruments.list()).find((n) => n.pid === bare(i.id));
      if (!x) return `<article><h3>${esc(i.name)}</h3><p>Not found.</p></article>`;
      return `<article><h3>${esc(x.name)} — ${esc(x.title)}</h3>${dl([["Kind", x.kind], ["Location", x.location], ["Status", x.status], ["Techniques", x.techniques], ["Contact", x.contact], ["Datasets", fmtNum(x.datasetCount)], ["Last run", x.lastRun && fmtDate(x.lastRun, true)]])}${para("Description", x.description)}</article>`;
    }
    case "published": {
      const p = (await api.published.list()).find((n) => n.doi === bare(i.id));
      if (!p) return `<article><h3>${esc(i.name)}</h3><p>Not found.</p></article>`;
      return `<article><h3>${esc(p.title)}</h3>${dl([["DOI", `https://doi.org/${p.doi}`], ["Creators", p.metadata.creators.map((c) => c.name)], ["Year", p.metadata.publicationYear], ["Publisher", p.metadata.publisher.name], ["Datasets", `${plural(p.datasetPids.length, "dataset")} · ${fmtBytes(p.sizeOfArchive)}`], ["Downloads", fmtNum(p.downloads)], ["Views", fmtNum(p.views)]])}${para("Abstract", p.abstract)}
        ${table(["Dataset PID"], p.datasetPids.map((d) => [d]))}</article>`;
    }
    case "job": {
      const j = (await api.jobs.list()).find((n) => n.id === bare(i.id));
      if (!j) return `<article><h3>${esc(i.name)}</h3><p>Not found.</p></article>`;
      return `<article><h3>${esc(JOB_KIND[j.type] ?? j.type)} · ${esc(j.id)}</h3>${dl([["Status", `${humanizeStatus(j.statusCode)} (${j.statusCode})`], ["Progress", `${Math.round(j.progress)}%`], ["Created", fmtDate(j.createdAt, true)], ["Size", fmtBytes(j.bytes)], ["Message", j.statusMessage]])}
        ${table(["Dataset", "PID"], j.datasetNames.map((n, k) => [n, j.jobParams.datasetList[k]?.pid ?? ""]))}</article>`;
    }
  }
}

// The whole selection as a printable document: one section per kind, the full record of every item.
export async function selectionHtml(list: SelItem[]) {
  const sections = await Promise.all(
    byKind(list).map(async ([k, l]) => `<section><h2>${esc(KIND_LABEL[k][1][0].toUpperCase() + KIND_LABEL[k][1].slice(1))} · ${l.length}</h2>${(await Promise.all(l.map(block))).join("")}</section>`),
  );
  return `<!doctype html><html><head><meta charset="utf-8"><title>Selection · metadatacatalogue</title><style>
    body{font:12.5px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:32px;max-width:860px}
    h1{font-size:20px;margin:0 0 2px}.sub{color:#64748b;margin:0 0 24px}
    h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#475569;border-bottom:2px solid #cbd5e1;padding-bottom:4px;margin:28px 0 12px}
    article{border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin:0 0 12px;break-inside:avoid}
    h3{font-size:15px;margin:0 0 8px}h4{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:12px 0 4px}
    p{margin:0 0 6px}dl{display:grid;grid-template-columns:max-content 1fr;gap:3px 16px;margin:0}dl div{display:contents}dt{color:#64748b}dd{margin:0}
    table{border-collapse:collapse;width:100%;margin-top:4px}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}th{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
    @media print{body{margin:10mm;max-width:none}article{page-break-inside:avoid}}</style></head>
    <body><h1>Selection</h1><p class="sub">${plural(list.length, "item")} · exported ${esc(new Date().toLocaleString())}</p>${sections.join("")}
    <script>window.onload=()=>{window.print()}</script></body></html>`;
}

// opens the document in a new tab and hands it to the browser's print dialog, where "Save as PDF" lives
export async function exportPdf(list: SelItem[]) {
  const w = window.open("", "_blank");
  if (!w) throw new Error("popup");
  w.document.write("<p style='font:14px sans-serif;margin:32px'>Preparing the export…</p>");
  const html = await selectionHtml(list);
  w.document.open();
  w.document.write(html);
  w.document.close();
}
