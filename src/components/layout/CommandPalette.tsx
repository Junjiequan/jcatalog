import { useEffect, useMemo, useRef, useState } from "react";
import { canCreateDatasets, useRole } from "@/lib/permissions";
import { useNavigate } from "react-router";
import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { Beaker, CornerDownLeft, Database, FileText, FlaskConical, Keyboard, Microscope, Moon, Plus, Search, Trash2, type LucideIcon } from "lucide-react";
import { Kbd } from "@/components/ui/Primitives";
import { useUI } from "@/store/ui";
import { useSelection } from "@/store/selection";
import { useDebounced } from "@/hooks/hooks";
import { api } from "@/api";
import { datasetLink, proposalLink } from "@/lib/query";
import { matchesSearch } from "@/lib/search";
import { proposalKind } from "@/types";
import { NAV } from "./nav";
import type { Dataset } from "@/types";

// what else the palette can find besides datasets: proposals, experiments, samples and instruments
interface Found { proposals: { id: string; title: string; pi: string; experiment: boolean }[]; samples: { id: string; name: string }[]; instruments: { id: string; name: string; title: string }[] }
const NONE: Found = { proposals: [], samples: [], instruments: [] };

// the same colours as the proposal and experiment icons elsewhere; one width, so the tags line up
const KIND_TAG = {
  dataset: { label: "Dataset", cls: "bg-teal-500/15 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300" },
  proposal: { label: "Proposal", cls: "bg-accent/15 text-accent" },
  experiment: { label: "Experiment", cls: "bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300" },
};

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  // what kind of thing it is, shown on every screen size (the hint is not)
  tag?: { label: string; cls: string };
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette() {
  useRole();
  const open = useUI((s) => s.paletteOpen);
  const recent = useUI((s) => s.recent);
  const set = useUI((s) => s.set);
  const selCount = useSelection((s) => Object.keys(s.items).length);
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Dataset[]>([]);
  const [found, setFound] = useState<Found>(NONE);
  const dq = useDebounced(q, 140);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setResults([]);
      setFound(NONE);
    }
  }, [open]);

  useEffect(() => {
    if (dq.trim().length < 2) return (setResults([]), setFound(NONE));
    let live = true;
    api.datasets.search(dq, 6).then((r) => live && setResults(r));
    Promise.all([api.proposals.list(), api.samples.list(), api.instruments.list()]).then(([ps, ss, is]) => {
      if (!live) return;
      setFound({
        proposals: ps.filter((p) => matchesSearch(dq, p.proposalId, p.title, p.pi, p.keywords, p.parentProposalId)).slice(0, 8).map((p) => ({ id: p.proposalId, title: p.title, pi: p.pi, experiment: proposalKind(p) === "experiment" })),
        samples: ss.filter((x) => matchesSearch(dq, x.sampleId, x.sampleName, x.short, x.description)).slice(0, 3).map((x) => ({ id: x.sampleId, name: x.sampleName })),
        instruments: is.filter((x) => matchesSearch(dq, x.name, x.title, x.kind, x.techniques)).slice(0, 3).map((x) => ({ id: x.pid, name: x.name, title: x.title })),
      });
    });
    return () => {
      live = false;
    };
  }, [dq]);

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => nav(to);
    const t = q.trim().toLowerCase();
    const out: Item[] = [];
    if (t) {
      results.forEach((d) => out.push({ id: d.pid, group: "Datasets", label: d.datasetName, hint: `${d.pid} · ${d.instrumentName}`, icon: Database, run: go(datasetLink(d.pid)) }));
      found.proposals.filter((p) => !p.experiment).slice(0, 4).forEach((p) => out.push({ id: `p-${p.id}`, group: "Proposals", label: p.title, hint: `${p.id} · ${p.pi}`, icon: FileText, run: go(proposalLink(p.id)) }));
      found.proposals.filter((p) => p.experiment).slice(0, 4).forEach((p) => out.push({ id: `e-${p.id}`, group: "Experiments", label: p.title, hint: `${p.id} · ${p.pi}`, icon: Beaker, run: go(proposalLink(p.id)) }));
      found.samples.forEach((x) => out.push({ id: `s-${x.id}`, group: "Samples", label: x.name, hint: x.id, icon: FlaskConical, run: go("/samples") }));
      found.instruments.forEach((x) => out.push({ id: `i-${x.id}`, group: "Instruments", label: x.name, hint: x.title, icon: Microscope, run: go("/instruments") }));
      out.push({ id: "search-all", group: "Search", label: `Search all datasets for “${q.trim()}”`, icon: Search, run: go(`/datasets?scope=all&q=${encodeURIComponent(q.trim())}`) });
    } else {
      recent.forEach((r) => out.push({ id: `r-${r.kind ?? "dataset"}-${r.pid}`, group: "Recent", label: r.name, hint: r.pid, tag: KIND_TAG[r.kind ?? "dataset"], icon: r.kind === "proposal" ? FileText : r.kind === "experiment" ? Beaker : Database, run: go(r.kind === "proposal" || r.kind === "experiment" ? proposalLink(r.pid) : datasetLink(r.pid)) }));
    }
    NAV.filter((n) => !t || n.label.toLowerCase().includes(t)).forEach((n) => out.push({ id: n.to, group: "Go to", label: n.label, hint: n.hint, icon: n.icon, run: go(n.to) }));
    const actions: Item[] = [
      ...(canCreateDatasets() ? [{ id: "create", group: "Actions", label: "Create a dataset", icon: Plus, run: () => set({ createOpen: true }) }] : []),
      { id: "theme", group: "Actions", label: "Toggle dark mode", icon: Moon, run: () => set({ theme: document.documentElement.classList.contains("dark") ? "light" : "dark" }) },
      { id: "keys", group: "Actions", label: "Show keyboard shortcuts", icon: Keyboard, run: () => set({ shortcutsOpen: true }) },
    ];
    if (selCount) actions.push({ id: "clear", group: "Actions", label: `Clear selection (${selCount})`, icon: Trash2, run: () => useSelection.getState().clear() });
    actions.filter((a) => !t || a.label.toLowerCase().includes(t)).forEach((a) => out.push(a));
    return out;
  }, [q, results, found, recent, selCount, nav, set]);

  useEffect(() => setIdx(0), [q, results.length]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>("[data-active=true]")?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const run = (it?: Item) => {
    if (!it) return;
    set({ paletteOpen: false });
    setTimeout(it.run, 0);
  };

  let lastGroup = "";
  return (
    <Dialog.Root open={open} onOpenChange={(o) => set({ paletteOpen: o })}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-950/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-[10vh] z-[60] mx-auto w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop outline-hidden data-[state=open]:animate-scale-in"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="h-4 w-4 shrink-0 text-subtle" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIdx((i) => Math.min(items.length - 1, i + 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIdx((i) => Math.max(0, i - 1));
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  run(items[idx]);
                }
              }}
              placeholder="Search datasets, proposals, samples, instruments…"
              className="h-14 flex-1 bg-transparent text-[15px] outline-hidden placeholder:text-subtle"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
            {items.map((it, i) => {
              const header = it.group !== lastGroup ? <div className="section-title px-2.5 pb-1 pt-3 first:pt-1">{it.group}</div> : null;
              lastGroup = it.group;
              return (
                <div key={it.id}>
                  {header}
                  <button
                    data-active={i === idx}
                    onMouseMove={() => setIdx(i)}
                    onClick={() => run(it)}
                    className={clsx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm", i === idx ? "bg-accent-soft text-accent" : "text-fg")}
                  >
                    <it.icon className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1 truncate font-medium" title={it.label}>{it.label}</span>
                    {it.hint && <span className="hidden max-w-[12rem] shrink-0 truncate text-xs text-muted sm:block" title={it.hint}>{it.hint}</span>}
                    {it.tag && <span className={clsx("w-[4.75rem] shrink-0 rounded-md py-0.5 text-center text-[11px] font-semibold", it.tag.cls)}>{it.tag.label}</span>}
                    <CornerDownLeft className={clsx("h-3.5 w-3.5 shrink-0 opacity-60", i !== idx && "invisible")} />
                  </button>
                </div>
              );
            })}
            {!items.length && <div className="px-4 py-10 text-center text-sm text-muted">Nothing matches “{q}”.</div>}
          </div>
          <div className="flex items-center gap-4 border-t border-line bg-surface-2/60 px-4 py-2 text-xs text-muted">
            <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
            <span className="ml-auto hidden sm:block">Tip: press <Kbd>/</Kbd> on any list to search it</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
