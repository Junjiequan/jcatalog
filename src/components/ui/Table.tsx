import { type ReactNode, useMemo } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, LayoutGrid, Rows3 } from "lucide-react";
import { type Density, type ListView, useUI } from "@/store/ui";
import { useSelection } from "@/store/selection";
import { useElementWidth, useMediaQuery } from "@/hooks/hooks";
import { Button } from "./Button";
import { Menu, MenuCheck, MenuLabel, MenuRadio, MenuSep } from "./Overlay";
import { Segmented } from "./navigation";

export interface Column<T> {
  key: string;
  label: string;
  right?: boolean;
  center?: boolean;
  className?: string;
  // a header the user can sort by (the key handed to `sort.onSort`)
  sort?: string;
  // a column with no visible title (a thumbnail), and one that hugs its content
  hideLabel?: boolean;
  narrow?: boolean;
  // When the table is too narrow for all its columns, the least important are dropped (never scrolled sideways).
  // `width` is the room the column needs (estimated); `rank` how long it stays: 0 goes last. Left out, a column
  // is estimated at 120px and goes from the right.
  fit?: { width?: number; rank?: number };
  // `active` is true for the row currently open in a side panel
  render: (row: T, active: boolean) => ReactNode;
}

// room for what is always there: the tick box, the open arrow, the first column (the row's name) and any thumbnail
const ROOM = { select: 40, trailing: 36, first: 280, narrow: 72, other: 120 };

// The columns that fit in `width` pixels, in their order. The first column and narrow ones (a thumbnail) always stay.
// Before the table has been measured nothing is dropped.
export function fitColumns<T>(columns: Column<T>[], width: number, extras: { selection?: boolean; trailing?: boolean } = {}): Column<T>[] {
  if (!width) return columns;
  const first = columns.findIndex((c) => !c.narrow);
  let budget = width - (extras.selection ? ROOM.select : 0) - (extras.trailing ? ROOM.trailing : 0);
  const stays = new Set<string>();
  columns.forEach((c, i) => {
    if (c.narrow || i === first) {
      stays.add(c.key);
      budget -= c.narrow ? ROOM.narrow : ROOM.first;
    }
  });
  const rest = columns
    .map((c, i) => ({ c, order: c.fit?.rank ?? i }))
    .filter(({ c }) => !stays.has(c.key))
    .sort((a, b) => a.order - b.order);
  for (const { c } of rest) {
    const need = c.fit?.width ?? ROOM.other;
    if (budget >= need) {
      stays.add(c.key);
      budget -= need;
    }
  }
  return columns.filter((c) => stays.has(c.key));
}

// Row selection for a Table: which rows are ticked, and how to flip one or the whole page
export interface TableSelection<T> {
  isSelected: (row: T) => boolean;
  toggle: (row: T) => void;
  togglePage: (rows: T[], allSelected: boolean) => void;
}

export const ViewSwitch = ({ value, onChange, className }: { value: ListView; onChange: (v: ListView) => void; className?: string }) => (
  <Segmented className={className} value={value} onChange={onChange} options={[{ value: "table", icon: Rows3, title: "List" }, { value: "cards", icon: LayoutGrid, title: "Cards" }]} />
);

// a stable empty list: a selector that returned a fresh [] each render would re-render forever
const NO_COLUMNS: string[] = [];

// Which of a page's columns to show: everything the user has not hidden; the first column always stays
export function useShownColumns(page: string) {
  const hidden = useUI((s) => s.hiddenColumns[page] ?? NO_COLUMNS);
  return <T,>(cols: Column<T>[]) => cols.filter((c, i) => i === 0 || !hidden.includes(c.key));
}

// The view-options menu every list page shares: table density, and which columns to show
export function ViewOptions<T>({ page, columns, className }: { page: string; columns?: Column<T>[]; className?: string }) {
  const density = useUI((s) => s.density);
  const hidden = useUI((s) => s.hiddenColumns[page] ?? NO_COLUMNS);
  const set = useUI((s) => s.set);
  const toggle = (key: string) => set({ hiddenColumns: { ...useUI.getState().hiddenColumns, [page]: hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key] } });
  return (
    <Menu tip="View options: density and columns" trigger={<Button size="icon" aria-label="View options" className={className}><Columns3 className="h-4 w-4" /></Button>}>
      <MenuLabel>Density</MenuLabel>
      <MenuRadio value={density} onValueChange={(v) => set({ density: v as Density })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
      {columns && columns.length > 1 && (
        <>
          <MenuSep />
          <MenuLabel>Columns</MenuLabel>
          {columns.slice(1).map((c) => <MenuCheck key={c.key} checked={!hidden.includes(c.key)} onCheckedChange={() => toggle(c.key)}>{c.label}</MenuCheck>)}
        </>
      )}
    </Menu>
  );
}

// The selection checkbox on a card corner: hidden until the card is hovered, kept visible once anything is selected
// (and always on touch screens), exactly like the dataset cards
export function CardCheck({ checked, onChange, label, className }: { checked: boolean; onChange: () => void; label: string; className?: string }) {
  const any = useSelection((s) => Object.keys(s.items).length > 0);
  return (
    // the click is only stopped from reaching the card behind; the checkbox inside takes the keyboard
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <label
      onClick={(e) => e.stopPropagation()}
      className={clsx(
        "absolute z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-line bg-surface shadow-xs transition-opacity pointer-coarse:opacity-100",
        checked || any ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100",
        className,
      )}
    >
      <input type="checkbox" className="accent-selection" aria-label={label} checked={checked} onChange={onChange} />
    </label>
  );
}

// A checkbox for cards and rows that sit inside a clickable area
export function SelectCheck({ checked, onChange, label, className }: { checked: boolean; onChange: () => void; label: string; className?: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className={clsx("h-4 w-4 shrink-0 cursor-pointer accent-selection", className)}
    />
  );
}

// The one table every page shares, Datasets included: flat, white, edge to edge. Optional: a selection column,
// sortable headers, an "active" row (open in a side panel) and a trailing affordance. On phones rows stack into
// label/value lines unless `phoneStack` is turned off.
export function Table<T>({ columns: wanted, rows, rowKey, onRow, onRowDoubleClick, density = "comfortable", stickyHeader, className, selection, sort, active, trailing, phoneStack = true, phoneSummary, rowAttrs }: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRow?: (row: T, e: React.MouseEvent) => void;
  onRowDoubleClick?: (row: T) => void;
  density?: "comfortable" | "compact";
  stickyHeader?: boolean;
  className?: string;
  selection?: TableSelection<T>;
  sort?: { key: string; dir: "asc" | "desc"; onSort: (key: string) => void };
  active?: (row: T) => boolean;
  trailing?: (row: T, active: boolean) => ReactNode;
  phoneStack?: boolean;
  // on a phone: only the first column plus this summary (chips and one muted line), the way the dataset list reads
  phoneSummary?: (row: T) => ReactNode;
  rowAttrs?: (row: T) => Record<string, string>;
}) {
  const [box, width] = useElementWidth<HTMLDivElement>();
  // on a phone the table is a stack of cards, not columns, so there is nothing to drop
  const phone = useMediaQuery("(max-width: 639px)");
  const columns = useMemo(() => (phone ? wanted : fitColumns(wanted, width, { selection: !!selection, trailing: !!trailing })), [wanted, width, phone, selection, trailing]);
  // the row's name takes the space that is left (width 100%, max-width 0 lets a table cell shrink below its text) and is cut with "…"
  const nameCol = columns.findIndex((c) => !c.narrow);
  const pad = density === "compact" ? "px-3 py-1.5" : "px-3 py-3";
  // every row is as tall as every other: a cell never wraps (long text ends in "…", the full text on hover)
  const rowH = density === "compact" ? "sm:h-10" : "sm:h-[3.75rem]";
  const padY = density === "compact" ? "py-1.5" : "py-3";
  const allSelected = !!selection && rows.length > 0 && rows.every((r) => selection.isSelected(r));
  const someSelected = !!selection && rows.some((r) => selection.isSelected(r));
  const stick = stickyHeader && "sticky top-0 z-10";
  const SortHead = ({ c }: { c: Column<T> }) => {
    if (!c.sort || !sort) return <span className={clsx(c.hideLabel && "sr-only")}>{c.label}</span>;
    const on = sort.key === c.sort;
    const Icon = !on ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button onClick={() => sort.onSort(c.sort!)} className={clsx("group inline-flex items-center gap-1 font-semibold uppercase tracking-wider hover:text-fg", c.right && "flex-row-reverse", on && "text-fg")}>
        {c.label}
        <Icon className={clsx("h-3 w-3", !on && "opacity-0 group-hover:opacity-60")} />
      </button>
    );
  };
  return (
    <div ref={box} data-band className={clsx(!stickyHeader && "overflow-x-auto overflow-y-hidden", "bg-surface", className)}>
      <table className={clsx("w-full border-separate border-spacing-0 text-[13px]", phoneStack && "max-sm:block")}>
        <thead className={clsx(phoneStack && !phoneSummary && "max-sm:hidden", phoneStack && phoneSummary && "max-sm:block")}>
          <tr className={clsx("text-left text-[11px] font-semibold uppercase tracking-wider text-subtle", phoneStack && phoneSummary && "max-sm:flex max-sm:items-center max-sm:gap-2 max-sm:px-4 max-sm:py-2.5")}>
            {selection && (
              <th className={clsx("w-10 border-b border-line bg-surface py-2.5 pl-4", stick, phoneStack && phoneSummary && "max-sm:w-7 max-sm:border-0 max-sm:p-0")}>
                <input type="checkbox" className="accent-selection" aria-label="Select all on this page" checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }} onChange={() => selection.togglePage(rows, allSelected)} />
              </th>
            )}
            {columns.map((c, i) => (
              <th key={c.key} className={clsx("whitespace-nowrap border-b border-line bg-surface last:pr-4 sm:last:pr-6", c.narrow ? "w-0 py-2.5 pl-2 pr-1" : "px-3 py-2.5", stick, c.right && "text-right", c.center && "text-center", c.className, phoneStack && phoneSummary && (i > 0 ? "max-sm:hidden!" : "max-sm:border-0 max-sm:p-0"))}>
                <SortHead c={c} />
              </th>
            ))}
            {trailing && <th className={clsx("w-8 border-b border-line bg-surface", stick)}><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        {/* compact: one line per row — secondary lines (class "sub") are hidden */}
        <tbody className={clsx(phoneStack && "max-sm:block", density === "compact" && "[&_.sub]:hidden")}>
          {rows.map((r) => {
            const on = !!active?.(r);
            const picked = !!selection?.isSelected(r);
            return (
              <tr
                key={rowKey(r)}
                {...rowAttrs?.(r)}
                onClick={onRow && ((e) => onRow(r, e))}
                onDoubleClick={onRowDoubleClick && (() => onRowDoubleClick(r))}
                className={clsx(
                  "group transition-colors",
                  phoneStack && "max-sm:block max-sm:border-b max-sm:border-line max-sm:px-4 max-sm:py-3 max-sm:last:border-b-0",
                  phoneStack && phoneSummary && "max-sm:grid! max-sm:grid-cols-[1.75rem_minmax(0,1fr)] max-sm:gap-x-2",
                  onRow && "cursor-pointer select-none",
                  picked ? "bg-selection-soft/50" : on ? "bg-surface-2" : onRow && "hover:bg-surface-2",
                )}
              >
                {selection && (
                  <td className={clsx("border-b border-line pl-4 align-middle group-last:border-b-0", padY, on && "shadow-[inset_3px_0_0_rgb(var(--accent))]", phoneStack && (phoneSummary ? "max-sm:row-span-2 max-sm:self-start max-sm:border-0 max-sm:p-0 max-sm:pt-0.5" : "max-sm:float-right max-sm:border-0 max-sm:p-0"))} onClick={(e) => e.stopPropagation()}>
                    <SelectCheck checked={picked} onChange={() => selection.toggle(r)} label={`Select ${rowKey(r)}`} />
                  </td>
                )}
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    data-label={c.label}
                    className={clsx(
                      "overflow-hidden whitespace-nowrap border-b border-line align-middle group-last:border-b-0 last:pr-4 sm:last:pr-6",
                      rowH,
                      c.narrow ? clsx("pl-2 pr-1", padY) : pad,
                      c.right && "text-right",
                      c.center && "text-center",
                      !selection && i === 0 && on && "shadow-[inset_3px_0_0_rgb(var(--accent))]",
                      i === nameCol && "sm:w-[20rem] sm:min-w-[14rem] sm:max-w-[20rem]",
                      c.className,
                      phoneStack && "max-sm:border-0 max-sm:px-0 max-sm:py-0.5",
                      phoneStack && phoneSummary && (i > 0 ? "max-sm:hidden!" : "max-sm:col-start-2"),
                      phoneStack && (i === 0
                        ? "max-sm:block max-sm:pb-1.5 max-sm:text-left"
                        : "max-sm:flex max-sm:items-baseline max-sm:justify-between max-sm:gap-4 max-sm:text-right max-sm:before:shrink-0 max-sm:before:text-[11px] max-sm:before:font-medium max-sm:before:uppercase max-sm:before:tracking-wider max-sm:before:text-subtle max-sm:before:content-[attr(data-label)]"),
                    )}
                  >
                    {c.render(r, on)}
                  </td>
                ))}
                {phoneSummary && <td className="hidden max-sm:col-start-2 max-sm:block max-sm:border-0 max-sm:p-0">{phoneSummary(r)}</td>}
                {trailing && <td className={clsx("border-b border-line pr-3 text-subtle group-last:border-b-0", padY, phoneStack && "max-sm:hidden")}>{trailing(r, on)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
