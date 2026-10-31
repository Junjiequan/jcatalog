import { useEffect, useMemo, useRef, useState } from "react";
import { canCreateDatasets, useRole } from "@/lib/permissions";
import { useLocation, useNavigate } from "react-router";
import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { CornerDownLeft, Keyboard, Moon, Plus, Search, Trash2, Zap, type LucideIcon } from "lucide-react";
import { Kbd } from "@/components/ui/Primitives";
import { useUI } from "@/store/ui";
import { useSelection } from "@/store/selection";
import { NAV } from "./nav";
import { KIND_TAG, RECENT_ICON, recentLink } from "./recent";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  // what kind of thing it is, as quiet text beside it; its icon tile carries the colour
  tag?: { label: string; cls: string };
  // the keys that do the same without the palette
  keys?: string[];
  // colours of the tile behind the icon
  tile: string;
  icon: LucideIcon;
  run: () => void;
}

// the typed letters picked out in a label, so it is clear why a row is there
function Mark({ text, q }: { text: string; q: string }) {
  const t = q.trim();
  const at = t ? text.toLowerCase().indexOf(t.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<span className="font-bold underline decoration-accent/60 decoration-2 underline-offset-2">{text.slice(at, at + t.length)}</span>{text.slice(at + t.length)}</>;
}

// where a typed word can be taken to be searched: the list of the section the user is in (datasets from anywhere else)
const SECTIONS: Record<string, { noun: string; to: string }> = {
  datasets: { noun: "datasets", to: "/datasets?scope=all" },
  proposals: { noun: "proposals", to: "/proposals" },
  experiments: { noun: "experiments", to: "/experiments" },
  samples: { noun: "samples", to: "/samples" },
  instruments: { noun: "instruments", to: "/instruments" },
  published: { noun: "published data", to: "/published" },
};

export function CommandPalette() {
  useRole();
  const open = useUI((s) => s.paletteOpen);
  const recent = useUI((s) => s.recent);
  const set = useUI((s) => s.set);
  const selCount = useSelection((s) => Object.keys(s.items).length);
  const nav = useNavigate();
  const here = SECTIONS[useLocation().pathname.split("/")[1]] ?? SECTIONS.datasets;
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => nav(to);
    const t = q.trim().toLowerCase();
    const out: Item[] = [];
    // what was opened lately, narrowed by what is typed; nothing here asks the server
    recent.filter((r) => !t || `${r.name} ${r.pid}`.toLowerCase().includes(t)).forEach((r) => out.push({ id: `r-${r.kind ?? "dataset"}-${r.pid}`, group: "Recent", label: r.name, hint: r.pid, tag: KIND_TAG[r.kind ?? "dataset"], tile: KIND_TAG[r.kind ?? "dataset"].cls, icon: RECENT_ICON[r.kind ?? "dataset"], run: go(recentLink(r.kind, r.pid)) }));
    NAV.filter((n) => !t || n.label.toLowerCase().includes(t)).forEach((n) => out.push({ id: n.to, group: "Go to", label: n.label, hint: n.hint, keys: ["G", n.key.toUpperCase()], tile: "bg-surface-3 text-muted", icon: n.icon, run: go(n.to) }));
    const actions: Item[] = [
      ...(canCreateDatasets() ? [{ id: "create", group: "Actions", label: "Create a dataset", tile: "bg-accent-soft text-accent", icon: Plus, run: () => set({ createOpen: true }) }] : []),
      { id: "theme", group: "Actions", label: "Toggle dark mode", tile: "bg-accent-soft text-accent", icon: Moon, run: () => set({ theme: document.documentElement.classList.contains("dark") ? "light" : "dark" }) },
      { id: "keys", group: "Actions", label: "Show keyboard shortcuts", keys: ["?"], tile: "bg-accent-soft text-accent", icon: Keyboard, run: () => set({ shortcutsOpen: true }) },
    ];
    if (selCount) actions.push({ id: "clear", group: "Actions", label: `Clear selection (${selCount})`, tile: "bg-accent-soft text-accent", icon: Trash2, run: () => useSelection.getState().clear() });
    actions.filter((a) => !t || a.label.toLowerCase().includes(t)).forEach((a) => out.push(a));
    // a typed word can be taken to the list of the section the user is in, which searches there
    if (t) out.push({ id: "find", group: "Find", label: `Find “${q.trim()}” in ${here.noun}`, hint: `Opens the ${here.noun} list, which searches there`, tile: "bg-accent-soft text-accent", icon: Search, run: go(`${here.to}${here.to.includes("?") ? "&" : "?"}q=${encodeURIComponent(q.trim())}`) });
    return out;
  }, [q, recent, selCount, nav, set, here]);

  useEffect(() => setIdx(0), [q]);
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
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-950/45 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-[10vh] z-[60] mx-auto w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop outline-hidden data-[state=open]:animate-scale-in"
        >
          <Dialog.Title className="sr-only">Quick access</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg"><Zap className="h-3.5 w-3.5" strokeWidth={2.4} /></span>
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
              placeholder="Jump to something you opened, a page or an action…"
              className="h-14 flex-1 bg-transparent text-[15px] outline-hidden placeholder:text-subtle"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
            {items.map((it, i) => {
              const header = it.group !== lastGroup ? (
                <div className="flex items-center justify-between px-2.5 pb-1 pt-3 first:pt-1">
                  <span className="section-title">{it.group}</span>
                  {it.group === "Recent" && !q.trim() && <button onClick={() => useUI.getState().clearRecent()} className="text-[11px] font-medium text-subtle hover:text-fg">Clear history</button>}
                </div>
              ) : null;
              lastGroup = it.group;
              const on = i === idx;
              return (
                <div key={it.id}>
                  {header}
                  <button
                    data-active={on}
                    onMouseMove={() => setIdx(i)}
                    onClick={() => run(it)}
                    className={clsx("relative flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors", on ? "bg-accent-soft" : "hover:bg-surface-2")}
                  >
                    {on && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
                    <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", it.tile)}><it.icon className="h-4 w-4" strokeWidth={1.9} /></span>
                    <span className="min-w-0 flex-1">
                      <span className={clsx("block truncate font-medium", on && "text-accent")} title={it.label}><Mark text={it.label} q={q} /></span>
                      {it.hint && <span className="block truncate text-xs text-muted" title={it.hint}>{it.hint}</span>}
                    </span>
                    {it.tag && <span className="shrink-0 text-xs text-subtle">{it.tag.label}</span>}
                    {it.keys && <span className="hidden shrink-0 items-center gap-1 sm:flex">{it.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>}
                    <CornerDownLeft className={clsx("h-3.5 w-3.5 shrink-0 text-accent", !on && "hidden")} />
                  </button>
                </div>
              );
            })}
            {!items.length && <div className="px-4 py-10 text-center text-sm text-muted">Nothing matches “{q}”.</div>}
          </div>
          <div className="flex items-center gap-4 border-t border-line bg-surface-2/60 px-4 py-2 text-xs text-muted">
            <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
            <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
            <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> close</span>
            <span className="ml-auto hidden sm:block">Press <Kbd>/</Kbd> on any list to search it</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
