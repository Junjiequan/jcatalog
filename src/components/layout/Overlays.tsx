import { useEffect, useRef, useState } from "react";
import { canCreateDatasets, useRole } from "@/lib/permissions";
import { useNavigate } from "react-router";
import clsx from "clsx";
import { AlertCircle, CheckCircle2, ChevronRight, Eye, EyeOff, GripVertical, Info, ListChecks, MoreHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Callout, Kbd } from "@/components/ui/Primitives";
import { Menu, MenuItem, MenuLabel, MenuSep, Modal, Tip } from "@/components/ui/Overlay";
import { SidePanel, useDock } from "@/components/SidePanel";
import { ActionItems, BulkActionsMenu, useBulkRunner } from "@/components/BulkActions";
import { useToasts, toast, type ToastItem } from "@/store/toasts";
import { confirm, useConfirmStore } from "@/store/confirm";
import { useUI } from "@/store/ui";
import { useMediaQuery } from "@/hooks/hooks";
import { KIND_LABEL, byKind, selectionList, useSelection, type SelItem } from "@/store/selection";
import { fmtBytes, fmtNum, plural } from "@/lib/format";
import { MOD, NAV } from "./nav";

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONE = { success: "text-success", error: "text-danger", info: "text-accent" };

function ToastCard({ t }: { t: ToastItem }) {
  const dismiss = useToasts((s) => s.dismiss);
  const Icon = ICON[t.kind];
  useEffect(() => {
    if (!t.duration) return;
    const id = setTimeout(() => dismiss(t.id), t.duration);
    return () => clearTimeout(id);
  }, [t.id, t.duration, dismiss]);
  return (
    <div role="status" className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-pop animate-scale-in">
      <Icon className={clsx("mt-0.5 h-[18px] w-[18px] shrink-0", TONE[t.kind])} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{t.title}</div>
        {t.description && <div className="mt-0.5 text-[13px] text-muted">{t.description}</div>}
        {t.action && (
          <button
            onClick={() => {
              t.action!.onClick();
              dismiss(t.id);
            }}
            className="mt-1.5 text-[13px] font-semibold text-accent hover:underline"
          >
            {t.action.label}
          </button>
        )}
      </div>
      <button onClick={() => dismiss(t.id)} className="-mr-1 -mt-1 rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Dismiss"><X className="h-4 w-4" /></button>
    </div>
  );
}

export function ToastHost() {
  const items = useToasts((s) => s.items);
  return (
    <div className="pointer-events-none fixed inset-x-3 top-16 z-[90] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:w-[380px]">
      {items.map((t) => <ToastCard key={t.id} t={t} />)}
    </div>
  );
}

export function ConfirmHost() {
  const cur = useConfirmStore((s) => s.current);
  const close = useConfirmStore((s) => s.close);
  return (
    <Modal
      open={!!cur}
      onOpenChange={(o) => !o && close(false)}
      title={cur?.title ?? ""}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
          <Button variant={cur?.tone === "danger" ? "danger" : "primary"} onClick={() => close(true)}>{cur?.confirmLabel ?? "Confirm"}</Button>
        </>
      }
    >
      <p className="text-sm text-muted">{cur?.description}</p>
      {cur?.bullets && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {cur.bullets.map((b) => <li key={b} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-subtle" />{b}</li>)}
        </ul>
      )}
    </Modal>
  );
}

const Row = ({ keys, label }: { keys: string[]; label: string }) => (
  <div className="flex items-center justify-between py-1.5 text-sm">
    <span className="text-muted">{label}</span>
    <span className="flex items-center gap-1">{keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</span>
  </div>
);

export function ShortcutsDialog() {
  useRole();
  const open = useUI((s) => s.shortcutsOpen);
  const set = useUI((s) => s.set);
  return (
    <Modal open={open} onOpenChange={(o) => set({ shortcutsOpen: o })} title="Keyboard shortcuts" description="Work faster without leaving the keyboard." size="lg">
      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        <div>
          <div className="section-title mb-1">Anywhere</div>
          <Row label="Quick access" keys={[MOD, "K"]} />
          {canCreateDatasets() && <Row label="New dataset" keys={["C"]} />}
          <Row label="Toggle sidebar" keys={["["]} />
          <Row label="This help" keys={["?"]} />
          {NAV.map((n) => <Row key={n.key} label={`Go to ${n.label}`} keys={["G", n.key.toUpperCase()]} />)}
        </div>
        <div>
          <div className="section-title mb-1">Dataset list</div>
          <Row label="Focus search (any list)" keys={["/"]} />
          <Row label="Next / previous" keys={["J", "K"]} />
          <Row label="Add to selection" keys={["X"]} />
          <Row label="Open full details" keys={["Enter"]} />
          <Row label="Close preview" keys={["Esc"]} />
          <Row label="Toggle filters" keys={["F"]} />
        </div>
      </div>
    </Modal>
  );
}

// Clearing (or emptying a group) is asked about first; afterwards an Undo stays in the toast
async function clearSelection(list: SelItem[], what = "the selection") {
  const ok = await confirm({ title: `Clear ${what}?`, description: `${plural(list.length, "item")} will be unticked. You can undo this right after.`, confirmLabel: "Clear", tone: "danger" });
  if (!ok) return;
  useSelection.getState().removeMany(list.map((i) => i.id));
  toast.info("Selection cleared", { action: { label: "Undo", onClick: () => useSelection.getState().restore(list) }, duration: 7000 });
}

export function SelectionTray() {
  const items = useSelection((s) => s.items);
  const set = useUI((s) => s.set);
  const hidden = useUI((s) => s.trayHidden);
  const trayPos = useUI((s) => s.trayPos);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const bar = useRef<HTMLElement | null>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const [pos, setPos] = useState(trayPos);
  useEffect(() => setPos(trayPos), [trayPos]);
  const list = selectionList(items);
  if (!list.length) return null;
  const bytes = list.reduce((a, i) => a + (i.size ?? 0), 0);
  // "3 datasets · 1 proposal", or just the count when it is one kind
  const kinds = byKind(list);
  const gist = kinds.map(([k, l]) => `${l.length} ${KIND_LABEL[k][l.length === 1 ? 0 : 1]}`).join(" · ");

  // drag by the grip (or the folded pill): follows the pointer, stays inside the viewport, and the spot is remembered
  const clamp = (x: number, y: number) => {
    const r = bar.current?.getBoundingClientRect();
    const w = r?.width ?? 0, h = r?.height ?? 0;
    return { x: Math.min(Math.max(8, x), window.innerWidth - w - 8), y: Math.min(Math.max(8, y), window.innerHeight - h - 8) };
  };
  const onDown = (e: React.PointerEvent<HTMLElement>) => {
    const r = bar.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const next = clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy);
    if (!drag.current.moved && Math.abs(e.clientX - (drag.current.dx + (bar.current?.getBoundingClientRect().left ?? 0))) < 3 && Math.abs(e.clientY - (drag.current.dy + (bar.current?.getBoundingClientRect().top ?? 0))) < 3) return;
    drag.current.moved = true;
    setPos(next);
  };
  // returns whether the pointer actually dragged (so a plain tap can still act as a click)
  const onUp = () => {
    if (!drag.current) return false;
    const moved = drag.current.moved;
    drag.current = null;
    if (moved) set({ trayPos: pos });
    return moved;
  };
  const dock = () => (setPos(undefined), set({ trayPos: undefined }));
  const anchor = pos ? "fixed" : "fixed inset-x-0 bottom-[4.75rem] flex px-3 lg:bottom-6";
  const at = pos ? { left: pos.x, top: pos.y } : undefined;

  // phones get no floating bar at all: the count lives on the bottom nav's "More" and the sheet holds the actions
  if (!isDesktop) return null;
  // folded on desktop: the sidebar's basket already shows the count, so nothing else is drawn
  if (hidden) return null;
  const clear = () => clearSelection(list);

  return (
    <div className={clsx("pointer-events-none z-40", anchor, !pos && "justify-center")} style={at}>
      <div ref={bar as React.RefObject<HTMLDivElement | null>} className={clsx("pointer-events-auto flex items-center gap-2 rounded-2xl border border-line bg-surface py-2 pl-1.5 pr-2 shadow-pop", !pos && "animate-slide-up")}>
        <Tip label="Drag to move · double-click to dock">
          <button
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onDoubleClick={dock}
            aria-label="Move the selection bar"
            className="flex h-9 w-5 cursor-grab touch-none items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </Tip>
        <Tip label="Show the selected datasets">
          <button onClick={() => set({ selectionOpen: true })} className="group -ml-2 mr-1 flex items-center gap-2 rounded-lg py-1 pl-2 pr-2.5 text-left hover:bg-surface-2">
            <ListChecks className="h-5 w-5 text-accent" />
            <span>
              <span className="block text-sm font-semibold">{list.length} selected</span>
              <span className="tnum hidden max-w-[260px] truncate text-xs text-muted sm:block">{kinds.length === 1 && kinds[0][0] === "dataset" ? `${fmtBytes(bytes)} · ${fmtNum(list.reduce((a, i) => a + (i.files ?? 0), 0))} files` : gist}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-subtle transition-transform group-hover:translate-x-0.5" />
          </button>
        </Tip>
        <BulkActionsMenu items={list} />
        <Tip label="Hide the selection bar">
          <Button size="icon-sm" variant="ghost" onClick={() => set({ trayHidden: true })} aria-label="Hide the selection bar" className="text-muted"><EyeOff className="h-4 w-4" /></Button>
        </Tip>
        <Tip label="Clear selection">
          <Button size="icon-sm" variant="ghost" onClick={clear} aria-label="Clear selection" className="text-muted"><Trash2 className="h-4 w-4" /></Button>
        </Tip>
      </div>
    </div>
  );
}

export function SelectionSheet() {
  const open = useUI((s) => s.selectionOpen);
  const trayHidden = useUI((s) => s.trayHidden);
  const set = useUI((s) => s.set);
  const items = useSelection((s) => s.items);
  const nav = useNavigate();
  const runner = useBulkRunner(() => set({ selectionOpen: false }));
  const list = selectionList(items);
  const groups = byKind(list);
  // docked beside the page, opening an item should not close the panel: the list stays at hand
  const docked = !!useDock().slot;
  return (
    <SidePanel
      open={open}
      onClose={() => set({ selectionOpen: false })}
      title={`Selection · ${list.length}`}
      footer={
        list.length ? (
          <div className="flex w-full items-center justify-end gap-2">
            {trayHidden && <Button variant="ghost" className="mr-auto" onClick={() => set({ trayHidden: false })}><Eye className="h-4 w-4" />Show the selection bar</Button>}
            <Button onClick={() => clearSelection(list)}>
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
          </div>
        ) : undefined
      }
    >
      {list.length === 0 ? (
        <div className="px-4 py-6">
          <Callout tone="neutral" title="Nothing selected yet">Tick the checkbox on any dataset, proposal, sample, instrument or publication — or press <Kbd>X</Kbd> on a dataset — to collect it here.</Callout>
        </div>
      ) : (
        // one group per kind, so datasets (downloadable) never blur into the rest (exportable)
        groups.map(([kind, l]) => (
          <section key={kind}>
            {/* heading: name, count, size, and one compact menu with the kind's actions for the whole group */}
            <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-line bg-surface-3 py-1 pl-4 pr-2">
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-muted">{KIND_LABEL[kind][1]} · {l.length}{kind === "dataset" && <span className="tnum ml-1 font-normal normal-case tracking-normal">· {fmtBytes(l.reduce((a, i) => a + (i.size ?? 0), 0))}</span>}</span>
              {/* every action for the whole group behind one ⋯ */}
              <Menu tip={`Actions for all ${l.length} ${KIND_LABEL[kind][l.length === 1 ? 0 : 1]}`} trigger={<Button size="icon-sm" variant="ghost" aria-label={`Actions for all ${KIND_LABEL[kind][1]}`}><MoreHorizontal className="h-4 w-4" /></Button>}>
                <MenuLabel>All {l.length} {KIND_LABEL[kind][l.length === 1 ? 0 : 1]}</MenuLabel>
                <ActionItems kind={kind} part={l} runner={runner} />
                <MenuSep />
                <MenuItem icon={Trash2} danger onSelect={() => clearSelection(l, `all ${KIND_LABEL[kind][1]} from the selection`)}>Remove all from selection</MenuItem>
              </Menu>
            </div>
            <ul className="divide-y divide-line">
              {l.map((i) => (
                <li key={i.id} className="group flex items-center gap-3 px-4 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => { if (!docked) set({ selectionOpen: false }); nav(i.link); }}>
                    <div className="truncate text-sm font-medium hover:text-accent">{i.name}</div>
                    <div className="tnum truncate text-xs text-muted">{i.sub}{i.kind === "dataset" && ` · ${fmtBytes(i.size ?? 0)}`}{i.archived && " · archived"}</div>
                  </button>
                  <Menu tip="Actions for this item" trigger={<Button size="icon-sm" variant="ghost" aria-label={`Actions for ${i.name}`} className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button>}>
                    <ActionItems kind={kind} part={[i]} runner={runner} />
                    <MenuSep />
                    <MenuItem icon={X} onSelect={() => useSelection.getState().removeMany([i.id])}>Remove from selection</MenuItem>
                  </Menu>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </SidePanel>
  );
}
