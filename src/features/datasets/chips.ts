import { Atom, CalendarDays, FileText, FlaskConical, HardDrive, Layers, Microscope, Tag, type LucideIcon } from "lucide-react";
import { api } from "@/api";
import { fmtDate } from "@/lib/format";
import { describeCond, parseQuery } from "@/lib/query";
import { MULTI_FIELDS, type DatasetQuery, type FacetField, type FilterGroup, type MultiField } from "@/types";

export const GROUP_ICON: Record<FilterGroup, LucideIcon> = { types: Layers, instruments: Microscope, techniques: Atom, proposals: FileText, keywords: Tag, storage: HardDrive, date: CalendarDays, conds: FlaskConical };

export interface Chip {
  id: FilterGroup;
  group: string;
  values: { id: string; label: string; remove: () => void }[];
  // connector before value j (j ≥ 1); undefined means the group is single-valued per dataset, so always "or"
  opAt?: (j: number) => "or" | "and";
  flipAt?: (j: number) => void;
}

// chip labels come from the local dictionaries
export function buildChips(q: DatasetQuery, update: (p: Partial<DatasetQuery>) => void): Chip[] {
  const out: Chip[] = [];
  // one chip per group, its values joined with "or"; the chips themselves combine with "and"
  const multi = (group: string, key: FacetField) => {
    const vals = q[key] as string[];
    if (!vals.length) return;
    const k = (MULTI_FIELDS as string[]).includes(key) ? (key as MultiField) : undefined;
    const ands = (k && q.and[k]) ?? [];
    out.push({
      id: key,
      group,
      // removing a value also drops the connectors after it one place
      values: vals.map((v, i) => ({
        id: v,
        label: api.options.label(key, v),
        remove: () => update({ [key]: vals.filter((x) => x !== v), ...(k && { and: { ...q.and, [k]: ands.filter((j) => j !== i).map((j) => (j > i ? j - 1 : j)) } }) } as Partial<DatasetQuery>),
      })),
      opAt: k ? (j) => (ands.includes(j) ? "and" : "or") : undefined,
      flipAt: k ? (j) => update({ and: { ...q.and, [k]: ands.includes(j) ? ands.filter((x) => x !== j) : [...ands, j] } }) : undefined,
    });
  };
  multi("Type", "types");
  multi("Instrument", "instruments");
  multi("Technique", "techniques");
  multi("Proposal", "proposals");
  multi("Keyword", "keywords");
  multi("Availability", "storage");
  if (q.from || q.to) {
    const text = q.from && q.to ? `${fmtDate(q.from)} – ${fmtDate(q.to)}` : q.from ? `since ${fmtDate(q.from)}` : `until ${fmtDate(q.to!)}`;
    out.push({ id: "date", group: "Created", values: [{ id: "date", label: text, remove: () => update({ from: undefined, to: undefined }) }] });
  }
  if (q.conds.length) out.push({ id: "conds", group: "Measurement", values: q.conds.map((c, i) => ({ id: String(i), label: describeCond(c), remove: () => update({ conds: q.conds.filter((_, j) => j !== i) }) })) });
  return out;
}

// one chip in words: "Technique: SANS or Diffraction"
export const chipText = (c: Chip) => `${c.group}: ${c.values.map((v, j) => (j > 0 ? ` ${c.flipAt ? c.opAt!(j) : c.id === "conds" ? "and" : "or"} ` : "") + v.label).join("")}`;

// the whole expression in words, for the collapsed applied-filter bar
export const summarize = (chips: Chip[], orBefore: FilterGroup[]) => chips.map((c, i) => `${i > 0 ? (orBefore.includes(c.id) ? " OR " : " AND ") : ""}${chipText(c)}`).join("");
