import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import clsx from "clsx";
import { Check, CloudUpload, FileText, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { Field, Segmented, BackButton } from "@/components/ui/Primitives";
import { TagInput } from "@/components/ui/TagInput";
import { api, type CreateInput } from "@/api";
import { fmtBytes, plural } from "@/lib/format";
import { datasetLink } from "@/lib/query";
import { toast } from "@/store/toasts";
import { useUI } from "@/store/ui";

interface Form {
  name: string;
  type: "raw" | "derived";
  proposalId: string;
  instrumentId: string;
  sampleId: string;
  description: string;
  keywords: string[];
  metadata: { key: string; value: string; unit: string }[];
  sourceFolder: string;
  files: { name: string; size: number }[];
}

const EMPTY: Form = { name: "", type: "raw", proposalId: "", instrumentId: "", sampleId: "", description: "", keywords: [], metadata: [{ key: "", value: "", unit: "" }], sourceFolder: "", files: [] };
const DRAFT_KEY = "metadatacatalogue.draft";
const STEPS = ["Basics", "Measurements", "Files", "Review"];
const QUICK = [
  { key: "sample_temperature", unit: "K" }, { key: "photon_energy", unit: "keV" }, { key: "exposure_time", unit: "s" },
  { key: "wavelength", unit: "Å" }, { key: "detector_distance", unit: "mm" },
];
const DEMO_FILES = Array.from({ length: 6 }, (_, i) => ({ name: `scan_${String(i + 1).padStart(4, "0")}.h5`, size: Math.round((1.2 + Math.random() * 2) * 1024 ** 3) }));

function loadDraft(): { form: Form; step: number } | null {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function CreateDatasetDialog() {
  const open = useUI((s) => s.createOpen);
  const set = useUI((s) => s.set);
  const nav = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonErr, setJsonErr] = useState("");
  const [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const proposals = useMemo(() => api.options.proposals(), []);
  const allInstruments = useMemo(() => api.options.instruments(), []);
  const allSamples = useMemo(() => api.options.samples(), []);
  const prop = proposals.find((p) => p.proposalId === form.proposalId);
  const instruments = prop ? allInstruments.filter((i) => prop.instrumentIds.includes(i.pid)) : allInstruments;
  const samples = prop ? allSamples.filter((s) => prop.sampleIds.includes(s.sampleId)) : allSamples;

  useEffect(() => {
    if (!open) return;
    const d = loadDraft();
    if (d && d.form.name + d.form.description + d.form.proposalId !== "") {
      setForm(d.form);
      setStep(Math.min(d.step, 3));
      setRestored(true);
    } else {
      setForm(EMPTY);
      setStep(0);
      setRestored(false);
    }
    setTried(false);
    setJsonOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step }));
      setSaved(true);
    }, 500);
    setSaved(false);
    return () => clearTimeout(t);
  }, [form, step, open]);

  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const pickProposal = (id: string) => {
    const p = proposals.find((x) => x.proposalId === id);
    patch({ proposalId: id, instrumentId: p?.instrumentIds.length === 1 ? p.instrumentIds[0] : form.instrumentId && p?.instrumentIds.includes(form.instrumentId) ? form.instrumentId : "", sampleId: p?.sampleIds.length === 1 ? p.sampleIds[0] : "" });
  };

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 3) e.name = "Give it a name of at least 3 characters.";
    else if (/\s/.test(form.name.trim())) e.name = "Use underscores instead of spaces, e.g. lyso_run_014.";
    if (!form.proposalId) e.proposalId = "Choose the proposal this data belongs to.";
    if (!form.instrumentId) e.instrumentId = "Choose the instrument it was measured on.";
    return e;
  }, [form]);

  const next = () => {
    if (step === 0 && Object.keys(errors).length) return setTried(true);
    setTried(false);
    setStep((s) => Math.min(3, s + 1));
  };

  const totalBytes = form.files.reduce((a, f) => a + f.size, 0);
  const metaRows = form.metadata.filter((m) => m.key.trim());

  const importJson = () => {
    try {
      const obj = JSON.parse(jsonText);
      if (typeof obj !== "object" || Array.isArray(obj) || obj === null) throw new Error();
      const rows = Object.entries(obj).map(([key, v]) => {
        const o = v as { value?: unknown; unit?: string };
        return o && typeof o === "object" && "value" in o ? { key, value: String(o.value), unit: o.unit ?? "" } : { key, value: String(v), unit: "" };
      });
      patch({ metadata: [...metaRows, ...rows] });
      setJsonOpen(false);
      setJsonText("");
      setJsonErr("");
      toast.success(`Imported ${plural(rows.length, "property", "properties")}`);
    } catch {
      setJsonErr("That doesn't look like a JSON object. Try {\"temperature\": {\"value\": 100, \"unit\": \"K\"}}.");
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    patch({ files: [...form.files, ...[...list].map((f) => ({ name: f.name, size: f.size }))] });
  };

  const create = async () => {
    setBusy(true);
    try {
      const input: CreateInput = { name: form.name.trim(), type: form.type, proposalId: form.proposalId, instrumentId: form.instrumentId, sampleId: form.sampleId || undefined, description: form.description.trim() || `${form.type === "raw" ? "Raw" : "Derived"} dataset created in metadatacatalogue.`, keywords: form.keywords, metadata: metaRows, sourceFolder: form.sourceFolder, fileCount: form.files.length || 1, bytes: totalBytes };
      const d = await api.datasets.create(input);
      localStorage.removeItem(DRAFT_KEY);
      set({ createOpen: false });
      nav(datasetLink(d.pid));
      toast.success("Dataset created", { description: `${d.datasetName} is now in your catalog.` });
    } catch {
      toast.error("Couldn't create the dataset", { description: "Nothing was saved, but your draft is intact. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const discard = () => {
    localStorage.removeItem(DRAFT_KEY);
    setForm(EMPTY);
    setStep(0);
    setRestored(false);
    setTried(false);
  };

  const sel = "field";
  return (
    <Modal
      open={open}
      onOpenChange={(o) => set({ createOpen: o })}
      title="Create dataset"
      description="Describe what you measured — you can add files and edit details later."
      size="lg"
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-xs text-subtle">{saved ? <><Check className="h-3.5 w-3.5 text-success" />Draft saved</> : "Saving draft…"}</span>
          <BackButton className="ml-0" disabled={step === 0} onClick={() => (setTried(false), setStep(step - 1))} />
          {step < 3 ? <Button variant="primary" onClick={next}>Continue</Button> : <Button variant="primary" loading={busy} onClick={create}>Create dataset</Button>}
        </>
      }
    >
      <ol className="mb-5 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={clsx("flex items-center gap-2 text-[13px] font-medium", i === step ? "text-fg" : i < step ? "text-accent" : "text-subtle")}
            >
              <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-xs", i === step ? "bg-accent text-accent-fg" : i < step ? "bg-accent-soft text-accent" : "bg-surface-3")}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && <span className={clsx("h-px flex-1", i < step ? "bg-accent/40" : "bg-line")} />}
          </li>
        ))}
      </ol>

      {restored && step === 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent animate-fade-in">
          <span>We restored your unfinished draft.</span>
          <button onClick={discard} className="font-semibold hover:underline">Start over</button>
        </div>
      )}

      {step === 0 && (
        <div className="space-y-4 animate-fade-in">
          <Field label="Dataset name" error={tried ? errors.name : undefined} hint="Short and searchable — you can rename it later.">
            <input autoFocus className={clsx(sel, tried && errors.name && "border-danger")} value={form.name} placeholder="e.g. lyso_pressure_run014" onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Proposal" error={tried ? errors.proposalId : undefined}>
              <select className={clsx(sel, tried && errors.proposalId && "border-danger")} value={form.proposalId} onChange={(e) => pickProposal(e.target.value)}>
                <option value="">Select a proposal…</option>
                {proposals.map((p) => <option key={p.proposalId} value={p.proposalId}>{p.proposalId} · {p.title}</option>)}
              </select>
            </Field>
            <Field label="Instrument" error={tried ? errors.instrumentId : undefined}>
              <select className={clsx(sel, tried && errors.instrumentId && "border-danger")} value={form.instrumentId} onChange={(e) => patch({ instrumentId: e.target.value })}>
                <option value="">Select an instrument…</option>
                {instruments.map((i) => <option key={i.pid} value={i.pid}>{i.name} · {i.title}</option>)}
              </select>
            </Field>
            <Field label="Sample (optional)">
              <select className={sel} value={form.sampleId} onChange={(e) => patch({ sampleId: e.target.value })}>
                <option value="">No sample</option>
                {samples.map((s) => <option key={s.sampleId} value={s.sampleId}>{s.sampleName}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <Segmented value={form.type} onChange={(v) => patch({ type: v })} options={[{ value: "raw", label: "Raw data" }, { value: "derived", label: "Derived" }]} />
            </Field>
          </div>
          <Field label="Description (optional)">
            <textarea rows={3} className="field h-auto resize-none py-2" value={form.description} placeholder="What was measured, and under what conditions?" onChange={(e) => patch({ description: e.target.value })} />
          </Field>
          <Field label="Keywords (optional)" hint="Press Enter after each keyword.">
            <TagInput value={form.keywords} onChange={(keywords) => patch({ keywords })} placeholder="e.g. protein, pressure" />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-sm text-muted">Measurements make your data findable by what was measured. Add what you know — everything here is optional.</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q.key} onClick={() => patch({ metadata: [...metaRows, { key: q.key, value: "", unit: q.unit }] })} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted hover:border-accent hover:text-accent">
                + {q.key.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {form.metadata.map((m, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_80px_auto] items-center gap-2">
                <input className="field" placeholder="Property" value={m.key} list="create-keys" onChange={(e) => patch({ metadata: form.metadata.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) })} />
                <input className="field" placeholder="Value" value={m.value} onChange={(e) => patch({ metadata: form.metadata.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
                <input className="field" placeholder="Unit" value={m.unit} onChange={(e) => patch({ metadata: form.metadata.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)) })} />
                <Button size="icon-sm" variant="ghost" aria-label="Remove property" onClick={() => patch({ metadata: form.metadata.length > 1 ? form.metadata.filter((_, j) => j !== i) : [{ key: "", value: "", unit: "" }] })}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            <datalist id="create-keys">{["sample_temperature", "photon_energy", "wavelength", "exposure_time", "detector_distance", "number_of_frames", "pixel_size"].map((k) => <option key={k} value={k} />)}</datalist>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => patch({ metadata: [...form.metadata, { key: "", value: "", unit: "" }] })}><Plus className="h-4 w-4" />Add property</Button>
            <Button size="sm" variant="ghost" onClick={() => setJsonOpen(!jsonOpen)}>Paste JSON</Button>
          </div>
          {jsonOpen && (
            <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3 animate-fade-in">
              <textarea rows={5} className="field h-auto resize-none py-2 font-mono text-xs" placeholder={'{ "sample_temperature": { "value": 100, "unit": "K" }, "detector": "EIGER2" }'} value={jsonText} onChange={(e) => (setJsonText(e.target.value), setJsonErr(""))} />
              {jsonErr && <p className="text-xs text-danger">{jsonErr}</p>}
              <div className="flex justify-end"><Button size="sm" variant="primary" disabled={!jsonText.trim()} onClick={importJson}>Import properties</Button></div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <Field label="Source folder (optional)" hint="Where the files live on the facility storage.">
            <input className="field font-mono text-[13px]" placeholder="/data/bio-sax/20250788/lyso_run014" value={form.sourceFolder} onChange={(e) => patch({ sourceFolder: e.target.value })} />
          </Field>
          <div
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => (e.preventDefault(), setDrag(false), addFiles(e.dataTransfer.files))}
            className={clsx("flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors", drag ? "border-accent bg-accent-soft" : "border-line")}
          >
            <CloudUpload className="h-8 w-8 text-subtle" strokeWidth={1.5} />
            <p className="mt-2 text-sm font-medium">Drop files here to list them in this dataset</p>
            <p className="mt-0.5 text-xs text-muted">Only file names and sizes are recorded — nothing is uploaded.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => fileInput.current?.click()}>Choose files…</Button>
              <Button size="sm" variant="ghost" onClick={() => patch({ files: [...form.files, ...DEMO_FILES] })}>Add sample files</Button>
            </div>
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
          </div>
          {form.files.length > 0 && (
            <div className="rounded-xl border border-line">
              <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-muted">
                <span>{plural(form.files.length, "file")} · {fmtBytes(totalBytes)}</span>
                <button onClick={() => patch({ files: [] })} className="font-medium hover:text-danger">Remove all</button>
              </div>
              <ul className="max-h-48 divide-y divide-line overflow-y-auto">
                {form.files.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                    <FileText className="h-4 w-4 text-subtle" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="tnum text-muted">{fmtBytes(f.size)}</span>
                    <button onClick={() => patch({ files: form.files.filter((_, j) => j !== i) })} aria-label="Remove file" className="text-subtle hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 animate-fade-in">
          <p className="text-sm text-muted">Everything look right? You can change any of this after creating the dataset.</p>
          {[
            ["Name", form.name, 0],
            ["Proposal", prop ? `${prop.proposalId} · ${prop.title}` : "—", 0],
            ["Instrument", allInstruments.find((i) => i.pid === form.instrumentId)?.name ?? "—", 0],
            ["Sample", allSamples.find((s) => s.sampleId === form.sampleId)?.sampleName ?? "None", 0],
            ["Type", form.type === "raw" ? "Raw data" : "Derived", 0],
            ["Keywords", form.keywords.join(", ") || "None", 0],
            ["Measurements", metaRows.length ? plural(metaRows.length, "property", "properties") : "None", 1],
            ["Files", form.files.length ? `${plural(form.files.length, "file")} · ${fmtBytes(totalBytes)}` : "None listed", 2],
          ].map(([k, v, s]) => (
            <div key={k as string} className="flex items-start justify-between gap-4 border-b border-line pb-2.5 text-[13px] last:border-0">
              <span className="w-24 shrink-0 text-muted">{k}</span>
              <span className="min-w-0 flex-1 break-words font-medium">{v}</span>
              <button onClick={() => setStep(s as number)} className="text-xs font-medium text-accent hover:underline">Edit</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
