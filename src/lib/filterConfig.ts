import { parse } from "yaml";
// the panel the app ships with: the same file a deployment can replace at runtime
import bundledYaml from "../../config/filters.yaml?raw";

// Reads and checks config/filters.yaml: which filters the Datasets side panel shows, in what order and how.
// The file is fetched at runtime, so a facility can change the panel without a rebuild. Anything wrong in it falls back
// to the bundled copy of the file and is reported in the console. Only functions and types live here; the settings are in config/.

export type FilterField = "techniques" | "instruments" | "proposals" | "keywords" | "created" | "data" | "measurements";
export type FilterWidget = "tiles" | "rows" | "chips" | "toggles" | "timeline" | "sliders";

export interface FilterEntry {
  field: FilterField;
  widget: FilterWidget;
  label: string;
  open: boolean;
  // values shown before "Show all" / "+N more"
  limit?: number;
  // measurements: only these properties can be added
  properties?: string[];
  // data: which of the two-value facets to show
  fields?: ("types" | "storage")[];
}

export interface FilterConfig {
  filters: FilterEntry[];
}

const SPEC: Record<FilterField, { widgets: FilterWidget[]; label: string; open: boolean; limit?: number }> = {
  techniques: { widgets: ["tiles", "rows"], label: "Technique", open: true, limit: 7 },
  instruments: { widgets: ["tiles", "rows"], label: "Instrument", open: true, limit: 5 },
  measurements: { widgets: ["sliders"], label: "Measurements", open: false },
  proposals: { widgets: ["rows"], label: "Proposal", open: false, limit: 5 },
  created: { widgets: ["timeline"], label: "Created", open: false },
  data: { widgets: ["toggles"], label: "Type", open: false },
  keywords: { widgets: ["chips", "rows"], label: "Keywords", open: false, limit: 8 },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

type Parsed = { config: FilterConfig | null; warnings: string[] };

function check(text: string): Parsed {
  const warnings: string[] = [];
  let doc: unknown;
  try {
    doc = parse(text);
  } catch (e) {
    return { config: null, warnings: [`filters.yaml is not valid YAML (${(e as Error).message.split("\n")[0]}); using the default panel`] };
  }
  if (!isObj(doc) || !Array.isArray(doc.filters)) {
    return { config: null, warnings: ['filters.yaml needs a top-level "filters:" list; using the default panel'] };
  }
  const seen = new Set<string>();
  const filters: FilterEntry[] = [];
  doc.filters.forEach((raw, i) => {
    const at = `filters[${i}]`;
    if (!isObj(raw)) return void warnings.push(`${at}: expected a mapping with a "field"; skipped`);
    const field = raw.field as FilterField;
    const spec = SPEC[field];
    if (!spec) return void warnings.push(`${at}: unknown field "${String(raw.field)}" (use ${Object.keys(SPEC).join(", ")}); skipped`);
    if (seen.has(field)) return void warnings.push(`${at}: "${field}" is listed twice; the later one is skipped`);
    seen.add(field);
    if (raw.enabled === false) return;
    let widget = spec.widgets[0];
    if (raw.widget !== undefined) {
      if (spec.widgets.includes(raw.widget as FilterWidget)) widget = raw.widget as FilterWidget;
      else warnings.push(`${at}: widget "${String(raw.widget)}" does not fit ${field} (use ${spec.widgets.join(" or ")}); using ${widget}`);
    }
    const entry: FilterEntry = { field, widget, label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : spec.label, open: typeof raw.open === "boolean" ? raw.open : spec.open, limit: spec.limit };
    if (raw.limit !== undefined) {
      if (Number.isInteger(raw.limit) && (raw.limit as number) > 0) entry.limit = raw.limit as number;
      else warnings.push(`${at}: limit must be a positive whole number; using ${spec.limit ?? "the default"}`);
    }
    if (field === "measurements" && Array.isArray(raw.properties)) entry.properties = raw.properties.filter((p): p is string => typeof p === "string");
    if (field === "data") {
      const f = Array.isArray(raw.fields) ? raw.fields.filter((x): x is "types" | "storage" => x === "types" || x === "storage") : undefined;
      if (raw.fields !== undefined && !f?.length) warnings.push(`${at}: fields must list types and/or storage; showing both`);
      else if (f?.length) entry.fields = f;
    }
    filters.push(entry);
  });
  return { config: { filters }, warnings };
}

// the panel the app ships with
export const defaultFilterConfig = (): FilterConfig => check(bundledYaml).config ?? { filters: [] };

export function parseFilterConfig(text: string): { config: FilterConfig; warnings: string[] } {
  const { config, warnings } = check(text);
  return { config: config ?? defaultFilterConfig(), warnings };
}

export async function loadFilterConfig(): Promise<FilterConfig> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}filters.yaml`, { cache: "no-cache" });
    // a dev/SPA server answers a missing file with the app's own HTML
    if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) return defaultFilterConfig();
    const { config, warnings } = parseFilterConfig(await res.text());
    warnings.forEach((w) => console.warn(`[filters.yaml] ${w}`));
    return config;
  } catch {
    return defaultFilterConfig();
  }
}
