import { useId, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { Check, Search } from "lucide-react";
import { api } from "@/api";
import { type DatasetQuery, type FacetOption } from "@/types";
import { P, toggleIn } from "./shared";
import { Section } from "./Section";

function OptionRow({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1 text-[13px] hover:bg-surface" title={label}>
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-[3px] h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint && <span className="tnum block truncate text-[11px] text-subtle">{hint}</span>}
      </span>
    </label>
  );
}

// A search box: click or type and a dropdown lists the newest entries, or the ones matching the text.
// Ticks stay in the open dropdown so several can be picked in one go; once it closes they sit under the box.
export function RowsFacet({ query, update, entry }: P) {
  const listId = useId();
  const field = entry.field as "techniques" | "instruments" | "proposals" | "keywords";
  const all = useMemo(() => api.options.facetValues(field), [field]);
  const selected = query[field];
  const limit = entry.limit ?? 8;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const t = text.trim().toLowerCase();
  const picked = all.filter((o) => selected.includes(o.value));
  const rest = (t ? all.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(t)) : all).filter((o) => !selected.includes(o.value)).slice(0, limit);
  const rows = [...picked, ...rest];
  const toggle = (v: string) => update({ [field]: toggleIn(selected, v) } as Partial<DatasetQuery>);
  const close = () => (setOpen(false), setText(""));
  const one = entry.label.toLowerCase();
  const Row = ({ o, i }: { o: FacetOption; i: number }) => {
    const on = selected.includes(o.value);
    return (
      <button
        role="option"
        aria-selected={on}
        onMouseEnter={() => setCursor(i)}
        onClick={() => toggle(o.value)}
        className={clsx("flex min-h-10 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px]", i === cursor && "bg-surface-2")}
      >
        <span className={clsx("flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border", on ? "border-accent bg-accent text-accent-fg" : "border-line-strong")}>
          {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{o.label}</span>
          {o.hint && <span className="tnum block truncate text-[11px] text-subtle">{o.hint}</span>}
        </span>
      </button>
    );
  };
  return (
    <Section sid={entry.field} title={entry.label} badge={selected.length} defaultOpen={entry.open} onToggle={(o) => !o && close()} onClear={() => update({ [field]: [] } as Partial<DatasetQuery>)}>
      <Popover.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} modal={false}>
        <Popover.Anchor asChild>
          <div ref={box} className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-subtle" />
            <input
              value={text}
              onChange={(e) => (setText(e.target.value), setCursor(picked.length), setOpen(true))}
              onClick={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  setCursor((c) => Math.min(c + 1, rows.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === "Enter" && rows[cursor]) {
                  e.preventDefault();
                  toggle(rows[cursor].value);
                } else if (e.key === "Escape") close();
              }}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-label={`Find a ${one}`}
              placeholder={`Find a ${one}…`}
              className="field h-8 pl-8 text-xs"
            />
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            side="bottom"
            avoidCollisions={false}
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => box.current?.contains(e.target as Node) && e.preventDefault()}
            className="z-[80] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border border-line bg-surface shadow-pop outline-hidden data-[state=open]:animate-fade-in"
            id={listId}
            role="listbox"
          >
            <div className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-3rem))] overflow-y-auto overscroll-contain p-1">
              {picked.map((o, i) => <Row key={o.value} o={o} i={i} />)}
              {picked.length > 0 && rest.length > 0 && <div className="my-1 border-t border-line" />}
              {rest.map((o, i) => <Row key={o.value} o={o} i={picked.length + i} />)}
              {!rows.length && <p className="px-2 py-2 text-xs text-subtle">Nothing matches “{text}”.</p>}
            </div>
            <div className="flex items-center justify-between border-t border-line px-2 py-1">
              <span className="text-[11px] text-subtle">{t ? "Matches" : "Newest first. Type to find the rest."}</span>
              <button onClick={close} className="rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft">Done{selected.length ? ` (${selected.length})` : ""}</button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {!open && picked.length > 0 && (
        <div className="-mx-1.5 mt-1.5">
          {picked.map((o) => <OptionRow key={o.value} checked onChange={() => toggle(o.value)} label={o.label} hint={o.hint} />)}
        </div>
      )}
    </Section>
  );
}
