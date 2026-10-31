import clsx from "clsx";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowRight, Beaker, Calendar, Check, Database, FileCode, FileSearch, FileText, Link2, MoreHorizontal, Plus } from "lucide-react";
import { Thumb } from "@/components/Thumb";
import { Badge, Avatar, ErrorState, EmptyState, ListToolbar, NoMatches, Page, PageHeader, Pager, STICKY_PAGER, CardCheck, CardGrid, KeywordChips, Segmented, Skeleton, CopyButton, Table, ViewOptions, ViewSwitch, cardCls, useShownColumns, type Column, type TableSelection, Breadcrumb, TabBar, Fact } from "@/components/ui/Primitives";
import { proposalItem, useSelection, type SelItem } from "@/store/selection";
import {proposalKind, proposalMeta, type HistoryEvent, type Proposal, type ProposalKind, storageOf, proposerName} from "@/types";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { InstrumentChips } from "@/components/InstrumentChips";
import { ClipRow } from "@/components/ui/Overlay";
import { useUI } from "@/store/ui";
import { SearchInput } from "@/components/ui/SearchInput";
import { Explain, Menu, MenuItem } from "@/components/ui/Overlay";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/Button";
import { currentUser } from "@/lib/session";
import { api } from "@/api";
import { toast } from "@/store/toasts";
import { useListView, usePaging, usePeekParam, useRecordRecent, useSearchText } from "@/hooks/hooks";
import { useResource } from "@/api/hooks";
import { fmtBytes, fmtDate, fmtNum, plural } from "@/lib/format";
import { datasetLink } from "@/lib/query";
import { StorageBadge } from "../datasets/shared";
import { KIND_UI, KindBadge, ProposalStatus, statusOf } from "./badges";
import { PeekSheet } from "@/components/PeekSheet";
import { ProposalPeek } from "./ProposalPeek";
import { AppliedFilters, FilterToggle, ListFilters, useListFilter, type Fields } from "@/components/FilterShell";
import { TagScopeProvider, useTagTarget } from "@/components/tagScope";


// Row selection over this page's items, shared by the table and the cards
function useRowSelection<T>(toItem: (row: T) => SelItem): TableSelection<T> & { checked: (row: T) => boolean } {
  const items = useSelection((s) => s.items);
  const checked = (row: T) => !!items[toItem(row).id];
  return {
    checked,
    isSelected: checked,
    toggle: (row) => useSelection.getState().toggleItem(toItem(row)),
    togglePage: (rows, all) => (all ? useSelection.getState().removeMany(rows.map((r) => toItem(r).id)) : useSelection.getState().addItems(rows.map(toItem))),
  };
}

// a tag clicked on these pages finds more proposals (or experiments), not datasets
// what each page's filter panel offers, and so what its query is built from
const PROPOSAL_FILTERS: Fields = ["instruments", "keywords"];
const EXPERIMENT_FILTERS: Fields = ["instruments", "keywords"];
export const ProposalsPage = () => <TagScopeProvider value="proposals"><ListFilters fields={PROPOSAL_FILTERS}><ProposalsList kind="proposal" /></ListFilters></TagScopeProvider>;
export const ExperimentsPage = () => <TagScopeProvider value="experiments"><ListFilters fields={EXPERIMENT_FILTERS}><ProposalsList kind="experiment" /></ListFilters></TagScopeProvider>;

// Proposals and experiments are separate pages built from the same list; an experiment always says which proposal it belongs to
function ProposalsList({ kind }: { kind: ProposalKind }) {
  const noun = kind === "experiment" ? "experiment" : "proposal";
  const { data, error, reload } = useResource(["proposals"], () => api.proposals.list());
  const [q, setQ] = useSearchText();
  const [who, setWho] = useState<"all" | "mine" | "public">("all");
  // tag filters live in the URL (?inst= ?tech= ?kw=), so a tag clicked anywhere opens the list already filtered
  const tags = useListFilter();
  const [, setSp] = useSearchParams();
  const setKw = useTagTarget().keyword;
  const list = useMemo(
    () => (data ?? []).filter((p) => (who === "all" || (who === "mine" ? currentUser().groups.includes(p.ownerGroup) : p.isPublished)) && proposalKind(p) === kind && tags.test({ instrumentIds: p.instrumentIds, keywords: p.keywords }) && matchesSearch(q, p.proposalId, p.title, p.pi, p.abstract, p.type, p.keywords, statusOf(p), p.parentProposalId, p.instrumentIds.map((id) => api.options.instruments().find((x) => x.pid === id)?.name ?? id))),
    [data, q, who, kind, tags],
  );
  const pg = usePaging(list, `${who}|${q}|${tags.key}`);
  // the proposal (or experiment) whose preview is open (?peek=), and the one before and after it on this page
  const [peek, setPeek] = usePeekParam();
  const at = pg.items.findIndex((x) => x.proposalId === peek);
  const step = (d: number) => (at + d >= 0 && at + d < pg.items.length ? () => setPeek(pg.items[at + d].proposalId) : undefined);
  const titleOf = (id?: string | null) => (id ? (data ?? []).find((x) => x.proposalId === id)?.title : undefined);
  const [view, setView] = useListView("proposals", "cards");
  const show = useShownColumns("proposals");
  const density = useUI((s) => s.density);
  const sel = useRowSelection<(typeof list)[number]>(proposalItem);
  const cols: Column<(typeof list)[number]>[] = [
    { key: "title", label: "Title", render: (p) => <><div className="truncate font-medium group-hover:text-accent" title={p.title}>{p.title}</div><div className="sub tnum text-xs text-muted">{p.proposalId}</div></> },
    ...(kind === "experiment" ? [{ key: "proposal", label: "Proposal", fit: { width: 110, rank: 4 }, className: "whitespace-nowrap", render: (p: (typeof list)[number]) => <Link to={`/proposals/${p.parentProposalId}`} onClick={(e) => e.stopPropagation()} className="block max-w-[7rem] truncate text-accent hover:underline" title={`${p.parentProposalId} · ${titleOf(p.parentProposalId)}`}><span className="tnum font-mono">{p.parentProposalId}</span></Link> }] : []),
    { key: "instruments", label: "Instruments", fit: { width: 190, rank: 2 }, className: "whitespace-nowrap", render: (p) => <InstrumentChips ids={p.instrumentIds} max={2} nowrap size="sm" /> },
    { key: "status", label: "Status", fit: { width: 110, rank: 1 }, render: (p) => <ProposalStatus p={p} /> },
    { key: "keywords", label: "Keywords", fit: { width: 270, rank: 3 }, className: "whitespace-nowrap", render: (p) => <KeywordChips words={p.keywords} max={2} nowrap onPick={setKw} size="sm" /> },
    { key: "pi", label: "Principal investigator", fit: { width: 190, rank: 6 }, render: (p) => <span className="flex items-center gap-2 whitespace-nowrap"><Avatar name={p.pi} size={22} />{p.pi}</span> },
    { key: "start", label: "Start", fit: { width: 110, rank: 5 }, className: "whitespace-nowrap", render: (p) => fmtDate(p.startTime) },
    { key: "end", label: "End", fit: { width: 110, rank: 8 }, className: "whitespace-nowrap", render: (p) => fmtDate(p.endTime) },
    { key: "n", label: "Datasets", fit: { width: 90, rank: 0 }, center: true, render: (p) => <span className="tnum font-semibold">{fmtNum(p.datasetCount)}</span> },
  ];
  return (
    <Page>
      <PageHeader title={kind === "experiment" ? "Experiments" : "Proposals"} />
      <ListToolbar>
        <FilterToggle place="start" />
        <SearchInput value={q} onChange={setQ} placeholder={kind === "experiment" ? "Search experiments by title, number, proposal or status…" : "Search proposals by title, number, investigator or status…"} />
        <Segmented value={who} onChange={setWho} options={[{ value: "mine", label: "My group" }, { value: "public", label: "Public" }, { value: "all", label: "All" }]} />
        <FilterToggle place="end" />
        <ViewOptions page="proposals" columns={cols} className="ml-auto" />
        <ViewSwitch value={view} onChange={setView} />
        <AppliedFilters />
      </ListToolbar>
      {error ? (
        <ErrorState onRetry={reload} />
      ) : !data ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : list.length === 0 ? (
        (q.trim() || tags.active) ? <NoMatches query={q} filters={tags.active} noun={kind === "experiment" ? "experiments" : "proposals"} onClear={() => { setQ(""); setSp((prev) => { const n = new URLSearchParams(prev); ["inst", "tech", "kw", "page"].forEach((k) => n.delete(k)); return n; }, { replace: true }); }} /> : <EmptyState icon={FileSearch} title={`No ${noun}s in this view`} description={who === "public" ? `No ${noun}s have been made public yet.` : who === "mine" ? `None of your groups own a ${noun} yet. Try Public or All.` : "Nothing to show."} />
      ) : (
        <>
        {view === "cards" ? (
        <CardGrid wide count={pg.items.length} hasMore={pg.hasMore} onNext={() => pg.setPage(pg.page + 1)}>
          {pg.items.map((p) => (
            // the same card as a sample, with the kind (proposal or experiment) as its icon colour and first badge
            // a click or Enter previews: the card itself is the control
            // the card is a mouse target with a key way in (Enter), so it takes focus
            // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-tabindex
            <div key={p.proposalId} onClick={() => setPeek(p.proposalId)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setPeek(p.proposalId)} className={cardCls(sel.checked(p), clsx("flex cursor-pointer flex-col p-5", peek === p.proposalId && "border-accent ring-2 ring-accent/25"))}>
              <CardCheck checked={sel.checked(p)} onChange={() => sel.toggle(p)} label={`Select ${p.proposalId}`} className="-right-2 -top-2" />
              <div className="flex items-center gap-3">
                <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", KIND_UI[proposalKind(p)].tile)}>{(() => { const I = KIND_UI[proposalKind(p)].icon; return <I className="h-5 w-5" />; })()}</span>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5"><ProposalStatus p={p} />{p.isPublished && <Badge tone="success">Public</Badge>}{currentUser().groups.includes(p.ownerGroup) && <Explain title="Your group" text="One of your groups owns this, so you can see all of its datasets, including unpublished ones."><span className="inline-flex cursor-help"><Badge tone="neutral">Your group</Badge></span></Explain>}</div>
              </div>
              <h3 className="mt-3 line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-snug" title={p.title}>{p.title}</h3>
              <div className="tnum mt-0.5 truncate font-mono text-xs text-muted">{p.proposalId}</div>
              <div className="mt-3"><InstrumentChips ids={p.instrumentIds} size="sm" /></div>
              <p className="mt-3 line-clamp-3 flex-1 whitespace-pre-line text-[13px] text-muted">{p.abstract}</p>
              {p.keywords.length > 0 && <div className="mt-3 min-h-[1.75rem]"><KeywordChips words={p.keywords} onPick={setKw} size="sm" /></div>}
              <dl className="mt-3 mb-4 space-y-1 text-[13px]">
                {p.parentProposalId && <div className="flex justify-between gap-3"><dt className="shrink-0 text-subtle">Proposal</dt><dd className="min-w-0 text-right font-medium"><Link to={`/proposals/${p.parentProposalId}`} className="block truncate text-accent hover:underline" title={titleOf(p.parentProposalId)}>{p.parentProposalId}</Link></dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-subtle">Investigator</dt><dd className="flex min-w-0 items-center gap-1.5 text-right font-medium"><Avatar name={p.pi} size={18} /><span className="truncate">{p.pi}</span></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-subtle">Period</dt><dd className="text-right font-medium">{fmtDate(p.startTime)} – {fmtDate(p.endTime)}</dd></div>
              </dl>
              <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
                <span className="tnum text-[13px] text-muted">{plural(p.datasetCount, "dataset")}</span>
              </div>
            </div>
          ))}
        </CardGrid>
        ) : (
          <Table
            rows={pg.items}
            density={density}
            rowKey={(p) => p.proposalId}
            selection={sel}
            onRow={(p) => setPeek(p.proposalId)}
            active={(p) => p.proposalId === peek}
            columns={show(cols)}
            phoneSummary={(p) => (
              <>
                <ClipRow className="mt-1" title="Instruments" full={<InstrumentChips ids={p.instrumentIds} size="sm" />}><InstrumentChips ids={p.instrumentIds} size="sm" nowrap /></ClipRow>
                <ClipRow className="tnum mt-1 text-xs text-muted" title="Details">{[statusOf(p) && statusOf(p).charAt(0) + statusOf(p).slice(1).toLowerCase(), p.pi, `${fmtDate(p.startTime)} – ${fmtDate(p.endTime)}`, plural(p.datasetCount, "dataset")].filter(Boolean).join(" · ")}</ClipRow>
              </>
            )}
          />
        )}
        <Pager className={STICKY_PAGER} from={pg.from} to={pg.to} totalLabel={list.length} page={pg.page} totalPages={pg.totalPages} hasMore={pg.hasMore} pageSize={pg.pageSize} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </>
      )}
      <PeekSheet open={!!peek} onClose={() => setPeek(null)} onPrev={step(-1)} onNext={step(1)}>{peek && <ProposalPeek id={peek} />}</PeekSheet>
    </Page>
  );
}

type PTab = "overview" | "schedule" | "team" | "instruments" | "samples" | "experiments" | "datasets" | "history";

// What happened to a proposal or experiment, taken from its record: creation, its link to a proposal, beam time, experiments, publication, updates
function recordHistory(p: Proposal, parent: Proposal | undefined, experiments: Proposal[], instName: (id: string) => string): HistoryEvent[] {
  const kind = proposalKind(p) === "experiment" ? "Experiment" : "Proposal";
  const ev: HistoryEvent[] = [{ id: "created", at: p.createdAt, kind: "created", actor: p.createdBy, text: `${kind} ${p.proposalId} created` }];
  if (parent) ev.push({ id: "linked", at: p.createdAt, kind: "ingested", actor: p.createdBy, text: `Linked to proposal ${parent.proposalId}` });
  p.MeasurementPeriodList.forEach((m, i) => ev.push({ id: `beam${i}`, at: p.createdAt, kind: "edited", actor: p.updatedBy, text: `Beam time booked on ${instName(m.instrument)}: ${fmtDate(m.start)} – ${fmtDate(m.end)}` }));
  experiments.forEach((x) => ev.push({ id: `exp-${x.proposalId}`, at: x.createdAt, kind: "ingested", actor: x.createdBy, text: `Experiment ${x.proposalId} added` }));
  if (p.isPublished) ev.push({ id: "pub", at: p.updatedAt, kind: "published", actor: p.updatedBy, text: `Made public${proposalMeta(p, "published_data_doi") ? ` with DOI ${proposalMeta(p, "published_data_doi")}` : ""}` });
  if (p.updatedAt !== p.createdAt) ev.push({ id: "updated", at: p.updatedAt, kind: "edited", actor: p.updatedBy, text: "Record updated" });
  return ev;
}

const downloadBlob = (name: string, text: string) => {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type: "application/json" })), download: name });
  a.click();
  URL.revokeObjectURL(a.href);
};


// The same layout as the dataset page: breadcrumb, a hero card, sticky tabs, tab body — filled from the SciCat proposal record
export function ProposalDetailPage() {
  const experiment = useLocation().pathname.startsWith("/experiments");
  return <TagScopeProvider value={experiment ? "experiments" : "proposals"}><ProposalDetail /></TagScopeProvider>;
}

function ProposalDetail() {
  const { id = "" } = useParams();
  const target = useTagTarget();
  const nav = useNavigate();
  const loc = useLocation();
  const [sp, setSp] = useSearchParams();
  const { data, error, reload } = useResource(["proposal", id], () => api.proposals.get(id));
  const inSel = useSelection((s) => !!s.items[`proposal:${id}`]);
  const seen = data?.proposal;
  useRecordRecent(seen && { kind: proposalKind(seen), pid: seen.proposalId, name: seen.title });
  if (error) return <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-8"><ErrorState title="Not found" message={error.message} onRetry={reload} /></div>;
  if (!data) return <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-8"><Skeleton className="mb-4 h-8 w-64" /><Skeleton className="h-48 w-full rounded-xl" /></div>;
  const { proposal: p, parent, experiments, instruments, samples, recent, datasetCount, size } = data;
  const kind = proposalKind(p);
  const m = (k: string) => proposalMeta(p, k);
  const instName = (iid: string) => instruments.find((x) => x.pid === iid)?.name ?? iid;
  const tabs: { id: PTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "schedule", label: "Beam time", count: p.MeasurementPeriodList.length },
    { id: "team", label: "Team", count: p.team.length },
    { id: "instruments", label: "Instruments", count: instruments.length },
    { id: "samples", label: "Samples", count: samples.length },
    ...(kind === "proposal" ? [{ id: "experiments" as PTab, label: "Experiments", count: experiments.length }] : []),
    { id: "datasets", label: "Datasets", count: datasetCount },
    { id: "history", label: "History" },
  ];
  const tab = (tabs.some((t) => t.id === sp.get("tab")) ? sp.get("tab") : "overview") as PTab;
  const setTab = (t: PTab) => setSp((prev) => { const n = new URLSearchParams(prev); n.set("tab", t); return n; }, { replace: true });
  const item: SelItem = proposalItem(p);
  const doi = m("published_data_doi") as string | undefined;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 animate-fade-in sm:px-8">
      <Breadcrumb back={() => (loc.key !== "default" ? nav(-1) : nav(kind === "experiment" ? "/experiments" : "/proposals"))} trail={[{ label: kind === "experiment" ? "Experiments" : "Proposals", to: kind === "experiment" ? "/experiments" : "/proposals" }]} current={p.proposalId} />

      <div className="card overflow-hidden">
        <div className="flex flex-col p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindBadge p={p} />
            <ProposalStatus p={p} />
            {p.isPublished && <Badge tone="success">Published</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">{p.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
            <span className="flex items-center gap-1"><span className="tnum">{p.proposalId}</span><CopyButton text={p.proposalId} label="Copy number" /></span>
            {parent && <Link to={`/proposals/${parent.proposalId}`} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-accent/25 bg-accent-soft/50 px-2 py-0.5 font-medium text-accent hover:bg-accent-soft"><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Belongs to proposal {parent.proposalId} · {parent.title}</span><ArrowRight className="h-3.5 w-3.5 shrink-0" /></Link>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"><InstrumentChips ids={p.instrumentIds} /></div>
          {p.keywords.length > 0 && <div className="mt-2"><KeywordChips words={p.keywords} onPick={target.keyword} /></div>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted">
            <span className="flex items-center gap-1.5"><Avatar name={p.pi} size={16} />{p.pi}</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{fmtDate(p.startTime)} – {fmtDate(p.endTime)}</span>
            <span className="tnum flex items-center gap-1.5"><Database className="h-4 w-4" />{fmtNum(datasetCount)} datasets · {fmtBytes(size)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-5">
            <Link to={`/datasets?scope=all&prop=${p.proposalId}`}><Button variant="primary"><Database className="h-4 w-4" />Browse datasets</Button></Link>
            <Button onClick={() => useSelection.getState().toggleItem(item)} className={inSel ? "border-accent bg-accent-soft text-accent" : ""}>
              {inSel ? <><Check className="h-4 w-4" />In selection</> : <><Plus className="h-4 w-4" />Add to selection</>}
            </Button>
            <Menu tip="More actions" trigger={<Button size="icon" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button>}>
              <MenuItem icon={Link2} onSelect={() => (navigator.clipboard?.writeText(location.href), toast.success("Link copied"))}>Copy link</MenuItem>
              <MenuItem icon={FileCode} onSelect={() => downloadBlob(`${p.proposalId}.json`, JSON.stringify(p, null, 2))}>Export record (JSON)</MenuItem>
            </Menu>
          </div>
        </div>
      </div>

      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      <div className="mt-5" key={tab}>
        {tab === "overview" && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div className="card p-5">
                <h3 className="mb-2 text-sm font-semibold">Abstract</h3>
                <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-fg/85">{p.abstract}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                {[["Datasets", fmtNum(datasetCount)], ["Total size", fmtBytes(size)], ["Started", fmtDate(p.startTime)], ["Ends", fmtDate(p.endTime)]].map(([k, v]) => (
                  <div key={k} className="card p-4"><div className="text-xs text-muted">{k}</div><div className="tnum mt-0.5 text-lg font-semibold">{v}</div></div>
                ))}
              </div>
              <div className="card p-5">
                <h3 className="mb-1 text-sm font-semibold">Facility metadata</h3>
                <p className="mb-2 text-[13px] text-muted">What the user office recorded for this {kind}.</p>
                <dl>
                  {Object.entries(p.metadata).map(([k, v]) => (
                    <Fact key={k} label={v.human_name}>
                      {k === "published_data_doi" ? <a href={`https://doi.org/${v.value}`} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline">{String(v.value)}</a>
                        : k.endsWith("_date") ? fmtDate(String(v.value))
                        : k.includes("email") ? <a href={`mailto:${v.value}`} className="text-accent hover:underline">{String(v.value)}</a>
                        : k === "pi_orcid" ? <a href={`https://orcid.org/${v.value}`} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline">{String(v.value)}</a>
                        : `${v.value}${v.unit ? " " + v.unit : ""}`}
                    </Fact>
                  ))}
                </dl>
              </div>
            </div>
            <div className="space-y-5">
              <div className="card p-5">
                <h3 className="mb-1 text-sm font-semibold">Details</h3>
                <dl>
                  <Fact label="Kind">{kind === "experiment" ? "Experiment" : "Proposal"}</Fact>
                  <Fact label="Type">{p.type}</Fact>
                  <Fact label="Number"><span className="tnum">{p.proposalId}</span></Fact>
                  <Fact label="Part of">{parent && <Link to={`/proposals/${parent.proposalId}`} className="text-accent hover:underline">{parent.proposalId}</Link>}</Fact>
                  <Fact label="Principal investigator">{p.pi}</Fact>
                  <Fact label="PI email"><a href={`mailto:${p.pi_email}`} className="text-accent hover:underline">{p.pi_email}</a></Fact>
                  <Fact label="Submitted by">{proposerName(p)}</Fact>
                  <Fact label="Local contact">{m("local_contact_firstname") ? `${m("local_contact_firstname")} ${m("local_contact_lastname")}` : undefined}</Fact>
                  <Fact label="Owner group"><span className="tnum">{p.ownerGroup}</span></Fact>
                  <Fact label="Published">{p.isPublished ? "Yes" : "No"}</Fact>
                  <Fact label="DOI">{doi && <a href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline">{doi}</a>}</Fact>
                </dl>
              </div>
              <div className="card p-5">
                <h3 className="mb-2 text-sm font-semibold">Who can see it</h3>
                <p className="mb-3 text-[13px] text-muted">Members of these groups can open its datasets.</p>
                <div className="flex flex-wrap gap-1.5">
                  {[p.ownerGroup, ...p.accessGroups.filter((g) => g !== p.ownerGroup)].map((g) => <span key={g} className="tnum inline-flex h-7 items-center rounded-md border border-line bg-surface-2 px-2.5 font-mono text-[13px] font-medium">{g}</span>)}
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === "schedule" && (
          p.MeasurementPeriodList.length === 0 ? <div className="card p-6"><EmptyState icon={Calendar} title="No beam time booked" description="Measurement periods appear here once the user office schedules them." /></div> : (
            <div className="card overflow-hidden">
              <table className="w-full border-separate border-spacing-0 text-[13px]">
                <thead><tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-subtle"><th className="border-b border-line px-5 py-2.5">Instrument</th><th className="border-b border-line px-3 py-2.5">From</th><th className="border-b border-line px-3 py-2.5">To</th><th className="border-b border-line px-3 py-2.5 text-right">Length</th></tr></thead>
                <tbody>
                  {p.MeasurementPeriodList.map((mp, i) => (
                    <tr key={i}><td className="border-b border-line px-5 py-3 font-medium">{instName(mp.instrument)}</td><td className="border-b border-line px-3 py-3">{fmtDate(mp.start, true)}</td><td className="border-b border-line px-3 py-3">{fmtDate(mp.end, true)}</td><td className="tnum border-b border-line px-3 py-3 text-right">{Math.max(1, Math.round((+new Date(mp.end) - +new Date(mp.start)) / 86400000))} days</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {tab === "team" && (
          <div className="card p-5">
            <ul className="space-y-3">
              {p.team.map((mem, i) => (
                <li key={mem} className="flex items-center gap-3 text-sm"><Avatar name={mem} size={32} /><div><div className="font-medium">{mem}</div><div className="text-xs text-muted">{i === 0 ? "Principal investigator" : proposerName(p) === mem ? "Proposer" : "Collaborator"}</div></div></li>
              ))}
            </ul>
          </div>
        )}
        {tab === "instruments" && (
          <div className="card divide-y divide-line overflow-hidden">
            {instruments.map((i) => (
              <Link key={i.pid} to={`/datasets?scope=all&inst=${i.pid}&prop=${p.proposalId}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-2">
                <span><span className="font-medium">{i.name}</span> <span className="text-muted">· {i.title}</span></span><ArrowRight className="h-4 w-4 text-subtle" />
              </Link>
            ))}
          </div>
        )}
        {tab === "samples" && (
          <div className="card divide-y divide-line overflow-hidden">
            {samples.map((x) => (
              <Link key={x.sampleId} to={`/datasets?scope=all&q=${encodeURIComponent(x.sampleName)}&prop=${p.proposalId}`} className="block px-5 py-3 text-sm hover:bg-surface-2">
                <div className="font-medium">{x.sampleName}</div><div className="line-clamp-1 text-xs text-muted">{x.description}</div>
              </Link>
            ))}
          </div>
        )}
        {tab === "experiments" && (
          experiments.length === 0 ? <div className="card p-6"><EmptyState icon={Beaker} title="No experiments yet" description="Experiments run under this proposal are listed here." /></div> : (
            <div className="card divide-y divide-line overflow-hidden">
              {experiments.map((x) => (
                <Link key={x.proposalId} to={`/experiments/${x.proposalId}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2">
                  <KindBadge p={x} />
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{x.title}</div><div className="tnum text-xs text-muted">{x.proposalId} · {fmtDate(x.startTime)} – {fmtDate(x.endTime)}</div></div>
                  <ProposalStatus p={x} />
                  <span className="tnum hidden w-24 text-right text-[13px] text-muted sm:block">{plural(x.datasetCount, "dataset")}</span>
                </Link>
              ))}
            </div>
          )
        )}
        {tab === "history" && <HistoryTimeline events={recordHistory(p, parent, experiments, instName)} />}
        {tab === "datasets" && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h3 className="text-sm font-semibold">Latest datasets</h3>
              <Link to={`/datasets?scope=all&prop=${p.proposalId}`} className="text-[13px] font-medium text-accent hover:underline">View all {fmtNum(datasetCount)} →</Link>
            </div>
            {recent.length === 0 ? <EmptyState icon={FileSearch} title="No datasets you can see" description="Datasets in this proposal are private to the team." /> : (
              <ul className="divide-y divide-line">
                {recent.map((d) => (
                  <li key={d.pid}>
                    <Link to={datasetLink(d.pid)} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2">
                      <Thumb d={d} preview className="h-9 w-14 shrink-0 rounded-md" />
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{d.datasetName}</div><div className="text-xs text-muted">{d.instrumentName} · {fmtDate(d.creationTime)}</div></div>
                      <span className="hidden sm:block"><StorageBadge storage={storageOf(d)} /></span>
                      <span className="tnum hidden w-20 text-right text-[13px] text-muted sm:block">{fmtBytes(d.size)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
