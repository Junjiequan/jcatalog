import clsx from "clsx";
import { useState } from "react";
import { BookmarkCheck, Eye, EyeOff, Pencil, ShieldCheck, RefreshCw, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Tip } from "@/components/ui/Overlay";
import { QueryPreview } from "@/features/datasets/QueryPreview";
import { Button } from "@/components/ui/Button";
import { BackButton, CopyButton, Segmented, AccountAvatar, RoleBadge } from "@/components/ui/Primitives";
import { currentUser } from "@/lib/session";
import { confirm } from "@/store/confirm";
import { toast } from "@/store/toasts";
import { useUI, type Density, type ListView, type Theme, type View } from "@/store/ui";

const makeToken = () => "mdc_" + Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, "0")).join("");

function Row({ title, desc, children, tone }: { title: string; desc?: string; children: React.ReactNode; tone?: "all" | "sub" }) {
  return (
    <div className={clsx("flex flex-wrap items-center justify-between gap-4 px-5", tone === "all" && "py-4", tone === "sub" && "py-2.5 pl-9", !tone && "py-4")}>
      <div className="max-w-md"><div className={clsx("text-sm", tone === "all" ? "font-semibold" : tone === "sub" ? "text-[13px] text-fg/90" : "font-medium")}>{title}</div>{desc && <div className="mt-0.5 text-[13px] text-muted">{desc}</div>}</div>
      <div>{children}</div>
    </div>
  );
}

// Every saved search, with rename in place, a preview of what it applies, apply, and delete
function SavedSearchesSection() {
  const saved = useUI((s) => s.savedSearches);
  const update = useUI((s) => s.updateSearch);
  const del = useUI((s) => s.deleteSearch);
  const nav = useNavigate();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const commit = (id: string) => {
    const name = draft.trim();
    if (name) update(id, { name });
    setEditing(null);
  };
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div><h2 className="text-sm font-semibold">Saved searches</h2><p className="mt-0.5 text-[13px] text-muted">{saved.length ? `${saved.length} saved · rename, check what each applies, apply or delete.` : "Save a search from the Datasets page and it shows up here."}</p></div>
        {saved.length > 0 && (
          <Button
            onClick={async () => {
              if (await confirm({ title: "Delete all saved searches?", description: `${saved.length} saved searches will be removed.`, confirmLabel: "Delete all", tone: "danger" })) {
                useUI.getState().set({ savedSearches: [] });
                toast.info("Saved searches cleared");
              }
            }}
          >
            Clear all
          </Button>
        )}
      </div>
      <ul className="divide-y divide-line">
        {saved.map((s) => (
          <li key={s.id} className="px-5 py-3">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="h-4 w-4 shrink-0 text-accent" />
              {editing === s.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commit(s.id)}
                  onKeyDown={(e) => (e.key === "Enter" ? commit(s.id) : e.key === "Escape" ? setEditing(null) : undefined)}
                  aria-label="Search name"
                  className="field h-8 max-w-xs text-sm"
                />
              ) : (
                <button onClick={() => (setDraft(s.name), setEditing(s.id))} title="Click to rename" className="min-w-0 truncate text-left text-sm font-medium hover:text-accent">{s.name}</button>
              )}
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <Tip label="Rename"><Button size="icon-sm" variant="ghost" aria-label={`Rename ${s.name}`} onClick={() => (setDraft(s.name), setEditing(s.id))}><Pencil className="h-3.5 w-3.5" /></Button></Tip>
                <Tip label={open === s.id ? "Hide what it applies" : "Show what it applies"}><Button size="icon-sm" variant="ghost" aria-pressed={open === s.id} aria-label={`Preview ${s.name}`} onClick={() => setOpen(open === s.id ? null : s.id)}><Eye className="h-3.5 w-3.5" /></Button></Tip>
                <Tip label="Apply it on the Datasets page"><Button size="sm" onClick={() => nav(`/datasets?${s.qs}`)}>Apply</Button></Tip>
                <Tip label="Delete">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${s.name}`}
                    onClick={async () => {
                      if (await confirm({ title: `Delete "${s.name}"?`, description: "The saved search is removed; the datasets are untouched.", confirmLabel: "Delete", tone: "danger" })) del(s.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </Tip>
              </span>
            </div>
            {open === s.id && <div className="mt-3 rounded-lg border border-line bg-surface-2/60 p-3"><QueryPreview qs={s.qs} /></div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

const VIEW_OPTIONS: { value: ListView; label: string }[] = [{ value: "table", label: "List" }, { value: "cards", label: "Cards" }];
// the list pages with a table/cards switch and their built-in default
const LIST_PAGES: [string, string, ListView][] = [["proposals", "Proposals", "cards"], ["samples", "Samples", "cards"], ["instruments", "Instruments", "cards"], ["published", "Published", "cards"], ["jobs", "Jobs", "table"]];

// chips for group ids; past a dozen the rest fold behind "+N more"
function GroupChips({ groups }: { groups: string[] }) {
  const [all, setAll] = useState(false);
  const LIMIT = 12;
  const shown = all ? groups : groups.slice(0, LIMIT);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {shown.map((g) => (
        <span key={g} className="tnum inline-flex h-7 items-center rounded-md border border-line bg-surface-2 px-2.5 font-mono text-[13px] font-medium">{g}</span>
      ))}
      {groups.length > LIMIT && (
        <button onClick={() => setAll(!all)} className="h-7 rounded-md border border-dashed border-line-strong px-2.5 text-xs font-medium text-muted hover:border-accent hover:text-accent">{all ? "Show fewer" : `+${groups.length - LIMIT} more`}</button>
      )}
    </div>
  );
}

type Tab = "account" | "preferences" | "saved";
const TABS: { value: Tab; label: string }[] = [{ value: "account", label: "Account" }, { value: "preferences", label: "Preferences" }, { value: "saved", label: "Saved searches" }];

export default function SettingsPage() {
  const ui = useUI();
  const nav = useNavigate();
  const loc = useLocation();
  // "cards" or "table" when every page agrees, otherwise mixed
  const shown = [ui.view === "grid" ? "cards" : "table", ...LIST_PAGES.map(([key, , fallback]) => ui.listViews[key] ?? fallback)];
  const allViews: ListView | "mixed" = shown.every((v) => v === shown[0]) ? (shown[0] as ListView) : "mixed";
  const [token, setToken] = useState(makeToken);
  const [show, setShow] = useState(false);
  // the tab lives in the URL, so a link can open Settings on a specific one
  const [sp, setSp] = useSearchParams();
  const tab = (TABS.some((t) => t.value === sp.get("tab")) ? sp.get("tab") : "account") as Tab;
  const setTab = (t: Tab) => setSp((prev) => { const n = new URLSearchParams(prev); n.set("tab", t); return n; }, { replace: true });
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 animate-fade-in sm:px-8 sm:py-8">
      {/* the page's own title is right below, so Back stands alone */}
      <BackButton className="mb-4" onClick={() => (loc.key !== "default" ? nav(-1) : nav("/datasets"))} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Make Metadata Catalog work the way you do.</p>
      </div>
      <Segmented className="mb-5" value={tab} onChange={setTab} options={TABS} />
      <div className="max-w-3xl space-y-6">
        {tab === "account" && (
          <>
        <section className="card">
          <div className="flex items-center gap-4 px-5 py-5">
            <AccountAvatar name={currentUser().name} role={currentUser().role} size={52} />
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-base font-semibold">{currentUser().name}</span><RoleBadge role={currentUser().role} /></div><div className="text-[13px] text-muted">{currentUser().email}</div></div>
          </div>
          {currentUser().role === "admin" && <div className="border-t border-line bg-accent-soft/50 px-5 py-3 text-[13px] text-accent-deep"><ShieldCheck className="mr-1.5 inline h-4 w-4 align-[-3px]" />You are an administrator: you can see every dataset, create datasets, and manage the data of any group.</div>}
          {/* groups decide what a user can see; listed as chips so a long list still scans at a glance */}
          <div className="border-t border-line px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold">Your groups <span className="tnum font-normal text-muted">· {currentUser().groups.length}</span></h2><p className="mt-0.5 text-[13px] text-muted">Datasets and proposals owned by any of these groups are visible to you.</p></div>
              <CopyButton text={currentUser().groups.join(", ")} label="Copy all groups" />
            </div>
            <GroupChips groups={currentUser().groups} />
          </div>
        </section>

        <section className="card">
          <div className="border-b border-line px-5 py-4"><h2 className="text-sm font-semibold">API access token</h2><p className="mt-0.5 text-[13px] text-muted">Use it to script against the catalog. Treat it like a password.</p></div>
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 font-mono text-[13px]">
              <span className="min-w-0 flex-1 truncate">{show ? token : "•".repeat(34)}</span>
              <button onClick={() => setShow(!show)} aria-label={show ? "Hide token" : "Show token"} className="text-subtle hover:text-fg">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              <CopyButton text={token} label="Copy token" />
            </div>
            <Button
              onClick={async () => {
                if (await confirm({ title: "Generate a new token?", description: "Your current token stops working immediately. Any scripts using it will need the new one.", confirmLabel: "Generate token", tone: "danger" })) {
                  setToken(makeToken());
                  setShow(true);
                  toast.success("New token generated", { description: "Copy it now — for security it's hidden again when you leave this page." });
                }
              }}
            >
              <RefreshCw className="h-4 w-4" />Regenerate
            </Button>
          </div>
        </section>
          </>
        )}

        {tab === "preferences" && (
          <>
        <section className="card divide-y divide-line">
          <Row title="Theme" desc="Follows your system by default."><Segmented value={ui.theme} onChange={(v: Theme) => ui.set({ theme: v })} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} /></Row>
          <Row title="Filter panel" desc="Open on the Datasets page, and its width."><div className="flex items-center gap-2"><Segmented value={ui.filtersOpen ? "open" : "closed"} onChange={(v: string) => ui.set({ filtersOpen: v === "open" })} options={[{ value: "open", label: "Open" }, { value: "closed", label: "Hidden" }]} /><Button size="sm" variant="ghost" disabled={ui.filtersWidth === 296} onClick={() => ui.set({ filtersWidth: 296 })}>Reset width</Button></div></Row>
          <Row title="Applied filters" desc="Show the query builder expanded under the search box."><Segmented value={ui.builderOpen ? "open" : "closed"} onChange={(v: string) => ui.set({ builderOpen: v === "open" })} options={[{ value: "open", label: "Expanded" }, { value: "closed", label: "Collapsed" }]} /></Row>
        </section>
        <section className="card">
          <div className="border-b border-line px-5 py-4"><h2 className="text-sm font-semibold">List views</h2><p className="mt-0.5 text-[13px] text-muted">How each page shows its items. The switch on the page itself changes the same setting.</p></div>
          <div className="divide-y divide-line">
            <Row tone="all" title="All pages" desc="Set every page below at once.">
              <Segmented
                value={allViews === "mixed" ? "mixed" : allViews}
                onChange={(v: ListView | "mixed") => v !== "mixed" && ui.set({ view: v === "cards" ? "grid" : "table", listViews: Object.fromEntries(LIST_PAGES.map(([key]) => [key, v])) })}
                options={VIEW_OPTIONS}
              />
            </Row>
            <Row tone="all" title="Compact rows" desc="Fits more on screen in every list.">
              <Segmented value={ui.density} onChange={(v: Density) => ui.set({ density: v })} options={[{ value: "comfortable", label: "Off" }, { value: "compact", label: "On" }]} />
            </Row>
            <div className="section-title bg-surface-2/60 px-5 py-2">Or choose per page</div>
            <Row tone="sub" title="Datasets"><Segmented value={ui.view} onChange={(v: View) => ui.set({ view: v })} options={[{ value: "table", label: "List" }, { value: "grid", label: "Cards" }]} /></Row>
            {LIST_PAGES.map(([key, label, fallback]) => (
              <Row tone="sub" key={key} title={label}><Segmented value={ui.listViews[key] ?? fallback} onChange={(v: ListView) => ui.set({ listViews: { ...ui.listViews, [key]: v } })} options={VIEW_OPTIONS} /></Row>
            ))}
          </div>
        </section>
        <section className="card divide-y divide-line">
          <Row title="Quick tips" desc="The getting-started hints on the Datasets page."><Segmented value={ui.tipsDismissed ? "off" : "on"} onChange={(v: string) => ui.set({ tipsDismissed: v === "off" })} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} /></Row>
          <Row title="Recently viewed" desc={`${ui.recent.length === 1 ? "1 item" : `${ui.recent.length} items`} offered in search before you type`}><Button disabled={!ui.recent.length} onClick={() => ui.set({ recent: [] })}>Clear</Button></Row>
          <Row title="Selection bar position" desc="Where you dragged the floating selection bar."><Button disabled={!ui.trayPos} onClick={() => ui.set({ trayPos: undefined })}>Dock to bottom</Button></Row>
        </section>
          </>
        )}

        {tab === "saved" && <SavedSearchesSection />}
      </div>
    </div>
  );
}
