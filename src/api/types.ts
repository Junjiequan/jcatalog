import type {Dataset, DatasetQuery, FacetField, FacetOption, FileEntry, Instrument, Job, MetaKeyInfo, Proposal, PublishedData, Sample, Attachment, AuthResult, AuthUser, DemoAccount, SignUpInput} from "@/types";

// The contract the UI programs against. Every screen talks to this and nothing else, so swapping the
// adapter (mock today, SciCat tomorrow) touches no component. The mock is in /mock (delete that folder to remove all dummy data); the backend is ./scicat.

export interface Page<T> {
  items: T[];
  // true when another page exists; the total is a separate, bounded call
  hasMore: boolean;
}

export interface Count {
  total: number;
  capped: boolean;
}

export interface CreateInput {
  name: string;
  runNumber?: string;
  type: "raw" | "derived";
  proposalId: string;
  instrumentId: string;
  sampleId?: string;
  description: string;
  keywords: string[];
  metadata: { key: string; value: string; unit: string }[];
  sourceFolder: string;
  fileCount: number;
  bytes: number;
}

export type DatasetPatch = Partial<Pick<Dataset, "description" | "keywords" | "sharedWith" | "datasetName">>;

export interface RelatedDatasets {
  sources: Dataset[];
  derived: Dataset[];
  siblings: Dataset[];
}

export interface FileListing {
  files: FileEntry[];
  total: number;
}

export type ProposalSummary = Proposal & { datasetCount: number };
export interface ProposalDetail {
  proposal: Proposal;
  // an experiment's proposal, and a proposal's experiments
  parent?: Proposal;
  experiments: (Proposal & { datasetCount: number })[];
  instruments: Instrument[];
  samples: Sample[];
  datasetCount: number;
  size: number;
  recent: Dataset[];
}
export type SampleSummary = Sample & { datasetCount: number };
export interface SampleDetail {
  sample: Sample;
  datasetCount: number;
  size: number;
  proposals: Proposal[];
  instruments: Instrument[];
  techniques: string[];
  recent: Dataset[];
}
export type InstrumentSummary = Instrument & { datasetCount: number; lastRun?: string };

// a page of matches only: no total, so the backend never has to count its keyword dictionary
export interface KeywordSearch {
  items: FacetOption[];
}

export interface CatalogApi {
  datasets: {
    list(q: DatasetQuery, signal?: AbortSignal): Promise<Page<Dataset>>;
    // bounded count: stops at `cap` so a huge catalogue never scans to the end
    total(q: DatasetQuery, signal?: AbortSignal, cap?: number): Promise<Count>;
    search(text: string, limit?: number): Promise<Dataset[]>;
    get(pid: string): Promise<Dataset>;
    related(pid: string): Promise<RelatedDatasets>;
    files(pid: string): Promise<FileListing>;
    // the measurement dictionary (SciCat's metadataKeys: key, readable name, usage count), served from an index and never by scanning datasets.
    // A catalogue can hold 500k+ keys, so it is only ever searched a page at a time, most used first.
    metaKeys(q: { text?: string; limit?: number; exclude?: string[] }): Promise<{ items: MetaKeyInfo[]; total: number }>;
    update(pid: string, patch: DatasetPatch, note?: string): Promise<Dataset>;
    remove(pid: string): Promise<Dataset>;
    restore(d: Dataset): Promise<void>;
    create(input: CreateInput): Promise<Dataset>;
    publish(pid: string): Promise<Dataset>;
    requestRetrieval(pid: string): Promise<Job>;
    requestDownload(pids: string[]): Promise<Job>;
  };
  auth: {
    signIn(email: string, password: string): Promise<AuthResult>;
    signOut(): Promise<void>;
    // a backend that keeps the session itself (a mock) is told who was signed in before a reload
    restore?(user: AuthUser): void;
    // only a test backend has these
    signUp?(input: SignUpInput): Promise<AuthResult>;
    demoAccounts?(): DemoAccount[];
    signInDemo?(email: string): Promise<AuthResult>;
  };
  attachments: {
    list(pid: string): Promise<Attachment[]>;
    add(pid: string, files: { fileName: string; mimeType: string; size: number; dataUrl: string; thumbnail?: string }[]): Promise<Attachment[]>;
    update(id: string, patch: { caption: string }): Promise<Attachment>;
    remove(id: string): Promise<void>;
    // the picture of one attachment (an image as it is, any other file as a drawn card): what a thumbnail shows
    picture(id: string): Promise<string | undefined>;
    // makes one attachment the picture that stands for the dataset, or none
    setThumbnail(pid: string, id: string | null): Promise<Dataset>;
  };
  proposals: {
    list(): Promise<ProposalSummary[]>;
    get(id: string): Promise<ProposalDetail>;
  };
  samples: { list(): Promise<SampleSummary[]>; get(id: string): Promise<SampleDetail> };
  instruments: { list(): Promise<InstrumentSummary[]> };
  published: { list(): Promise<PublishedData[]> };
  jobs: {
    list(): Promise<Job[]>;
    retry(id: string): Promise<void>;
  };
  // Small dictionaries the UI reads synchronously while rendering (filters, labels). An adapter loads
  // them once at start-up; they are never derived by scanning datasets.
  options: {
    label(field: FacetField, value: string): string;
    facetValues(field: FacetField): FacetOption[];
    searchKeywords(text: string, limit?: number): Promise<KeywordSearch>;
    proposals(): Proposal[];
    instruments(): Instrument[];
    samples(): Sample[];
  };
  // resolves once the dictionaries are in memory
  ready: Promise<void>;
}
