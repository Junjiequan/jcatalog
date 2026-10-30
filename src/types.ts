export type DatasetType = "raw" | "derived";
export type Storage = "online" | "archived" | "retrieving";
export type Scope = "mine" | "shared" | "public" | "all";

export interface MetaValue {
  value: number | string | boolean;
  unit?: string;
  group?: string;
}

export interface HistoryEvent {
  id: string;
  at: string;
  kind: "created" | "ingested" | "edited" | "shared" | "archived" | "published" | "retrieved";
  actor: string;
  text: string;
}

// SciCat's TechniqueClass: a name and the persistent identifier of the technique (usually a PaNET term)
export interface Technique {
  pid: string;
  name: string;
}

// SciCat's LifecycleClass: where the data is and what can be done with it. `storageOf` reads it as online, archived or retrieving.
export interface DatasetLifecycle {
  archivable: boolean;
  retrievable: boolean;
  publishable: boolean;
  isOnCentralDisk: boolean;
  archiveStatusMessage: string;
  retrieveStatusMessage: string;
  dateOfDiskPurging?: string;
  archiveRetentionTime?: string;
  dateOfPublishing?: string;
  publishedOn?: string;
  storageLocation?: string;
}

// SciCat's DatasetClass (the fields it stores), followed by what this app joins in for display
export interface Dataset {
  pid: string;
  datasetName: string;
  description: string;
  type: DatasetType;
  ownerGroup: string;
  accessGroups: string[];
  instrumentGroup?: string;
  isPublished: boolean;
  owner: string;
  ownerEmail: string;
  orcidOfOwner?: string;
  contactEmail: string;
  sharedWith: string[];
  sourceFolder: string;
  sourceFolderHost?: string;
  size: number;
  packedSize: number;
  numberOfFiles: number;
  numberOfFilesArchived: number;
  creationTime: string;
  startTime: string;
  endTime: string;
  // /Site-name/facility-name/instrumentOrBeamline-name
  creationLocation: string;
  dataFormat: string;
  // SciCat stores it as a string; it is the number facilities quote when they talk about a measurement
  runNumber: string;
  keywords: string[];
  license: string;
  classification?: string;
  validationStatus?: string;
  version: string;
  datasetlifecycle: DatasetLifecycle;
  techniques: Technique[];
  principalInvestigators: string[];
  proposalIds: string[];
  sampleIds: string[];
  instrumentIds: string[];
  // derived datasets: what they were made from, with what
  inputDatasets: string[];
  usedSoftware: string[];
  jobParameters?: Record<string, unknown>;
  scientificMetadata: Record<string, MetaValue>;
  comment?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  // ---- not stored on a SciCat dataset: looked up from the proposal, sample and instrument for display
  instrumentName: string;
  proposalId: string;
  proposalTitle: string;
  sampleId: string;
  sampleName: string;
  doi?: string;
  // the dataset's preview picture is always one of its attachments (as in SciCat); this points at it
  thumbnailAttachmentId?: string;
  history: HistoryEvent[];
}

// Online, archived or being retrieved, read from the SciCat lifecycle
export const storageOf = (d: Pick<Dataset, "datasetlifecycle">): Storage => {
  const l = d.datasetlifecycle;
  if (l.isOnCentralDisk) return "online";
  return /retriev/i.test(l.retrieveStatusMessage) && !/retrieved/i.test(l.retrieveStatusMessage) ? "retrieving" : "archived";
};
export const techniqueNames = (d: Pick<Dataset, "techniques">) => d.techniques.map((t) => t.name);

// SciCat's Instrument: pid, uniqueName, name and free-form customMetadata. This catalogue keeps what it shows about an instrument in customMetadata.
export interface InstrumentMeta {
  title: string;
  kind: string;
  location: string;
  status: "online" | "maintenance" | "offline";
  techniques: string[];
  description: string;
  contact: string;
  // a real photo, when the facility provides one; otherwise the generated art is used
  image?: string;
}
export interface Instrument extends InstrumentMeta {
  pid: string;
  uniqueName: string;
  name: string;
  customMetadata: InstrumentMeta;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

// SciCat's MeasurementPeriodClass
export interface MeasurementPeriod {
  instrument: string;
  start: string;
  end: string;
  comment?: string;
}

// SciCat's ProposalClass. `pi`, `team` and `sampleIds` are joined in for display (SciCat keeps the PI as first and last name, the rest in metadata).
export interface Proposal {
  proposalId: string;
  title: string;
  abstract: string;
  pi_email: string;
  pi_firstname: string;
  pi_lastname: string;
  // the person who submitted it (can differ from the principal investigator)
  email: string;
  firstname: string;
  lastname: string;
  startTime: string;
  endTime: string;
  MeasurementPeriodList: MeasurementPeriod[];
  // SciCat's structured metadata: each key carries a readable name next to its value (status, PI details, local contact, DOI…)
  metadata: Record<string, { human_name: string; value: string | number; unit?: string }>;
  // the proposal `type` tells a proposal from an experiment, and an experiment points at its proposal
  type: string;
  parentProposalId?: string | null;
  instrumentIds: string[];
  numberOfDatasets?: number;
  keywords: string[];
  ownerGroup: string;
  accessGroups: string[];
  instrumentGroup?: string;
  isPublished: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  // ---- display joins
  pi: string;
  team: string[];
  sampleIds: string[];
}

// the submitter's name as it appears in the team list (which carries titles such as Dr.)
export const proposerName = (p: Pick<Proposal, "firstname" | "lastname" | "team">) => {
  const plain = `${p.firstname} ${p.lastname}`.trim();
  return p.team.find((n) => n.replace(/^(Dr\.|Prof\.)\s+/, "") === plain) ?? plain;
};
export const proposalMeta = (p: Pick<Proposal, "metadata">, key: string) => p.metadata[key]?.value;

export type ProposalKind = "proposal" | "experiment";
export const PROPOSAL_TYPES = { proposal: "Default Proposal", experiment: "Experiment" } as const;
// "Experiment" in the type (or a parent proposal) makes it an experiment; anything else is a proposal
export const proposalKind = (p: Pick<Proposal, "type" | "parentProposalId">): ProposalKind => (/experiment/i.test(p.type) || p.parentProposalId ? "experiment" : "proposal");

// SciCat's SampleClass. `short`, `formula` and `groups` are this catalogue's extras for display.
export interface Sample {
  sampleId: string;
  sampleName: string;
  description: string;
  owner: string;
  type: string;
  proposalId?: string;
  parentSampleId?: string;
  sampleCharacteristics: Record<string, string>;
  ownerGroup: string;
  accessGroups: string[];
  isPublished: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  short: string;
  formula?: string;
  // fuller metadata in named groups (preparation, storage and safety, provenance): SciCat keeps it free-form
  groups?: Record<string, Record<string, string>>;
}

// An account is either an administrator or an ordinary user; what someone does in a project comes from their groups
export type Role = "admin" | "user";

// the signed-in person, as the backend describes them
export interface AuthUser {
  name: string;
  email: string;
  role: Role;
  groups: string[];
}
export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string };
// a test backend can offer sign-up and ready-made accounts to try
export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  // join the sample groups, so the account starts with data to look at
  withDemoData: boolean;
}
export interface DemoAccount {
  name: string;
  email: string;
  role: Role;
  blurb: string;
}

// SciCat's PublishedData; the DataCite fields live in `metadata`. `downloads`, `views` and `instrumentIds` are this catalogue's extras.
export type PublishedStatus = "private" | "public" | "registered" | "amended";
export interface PublishedData {
  pid: string;
  doi: string;
  title: string;
  abstract: string;
  numberOfFiles: number;
  sizeOfArchive: number;
  datasetPids: string[];
  registeredTime: string;
  status: PublishedStatus;
  metadata: {
    creators: { name: string; affiliation: string }[];
    publisher: { name: string };
    publicationYear: number;
    resourceType: string;
    license: string;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  downloads: number;
  views: number;
  instrumentIds: string[];
}

export type JobKind = "archive" | "retrieve" | "publish" | "download";
// SciCat's statusCode is a free-form string chosen by each facility's job configuration (no enum in the backend).
// The UI therefore classifies whatever arrives; see src/lib/jobs.ts.
export type JobStatus = string;
// SciCat's JobClass; `progress`, `datasetNames` and `bytes` are display extras.
export interface Job {
  id: string;
  type: JobKind;
  statusCode: JobStatus;
  statusMessage: string;
  ownerUser: string;
  ownerGroup: string;
  contactEmail: string;
  jobParams: { datasetList: { pid: string; files: string[] }[] };
  configVersion: string;
  jobResultObject: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  progress: number;
  datasetNames: string[];
  bytes: number;
}

// SciCat's Attachment: a caption and a thumbnail image on a dataset (also on a proposal or sample). Here the file itself comes with it.
export interface Attachment {
  id: string;
  datasetId: string;
  caption: string;
  thumbnail?: string;
  ownerGroup: string;
  accessGroups: string[];
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // the uploaded file, whatever it is: an image, a PDF, a script, a spreadsheet…
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface FileEntry {
  path: string;
  size: number;
  modified: string;
  kind: "image" | "data" | "text" | "archive" | "code" | "other";
}

export interface MetaCond {
  key: string;
  op: "eq" | "gt" | "lt" | "between";
  value: string;
  value2?: string;
  unit?: string;
}

export type SortKey = "creationTime" | "name" | "size" | "instrumentName" | "numberOfFiles" | "runNumber";

export interface DatasetQuery {
  q: string;
  scope: Scope;
  types: DatasetType[];
  instruments: string[];
  techniques: string[];
  proposals: string[];
  keywords: string[];
  storage: Storage[];
  from?: string;
  to?: string;
  conds: MetaCond[];
  // connectors: `and` lists where a value is "and"-ed to the one before it (facets a dataset can carry several of);
  // `orBefore` lists the groups joined to the previous group with "or" instead of "and"
  and: Partial<Record<MultiField, number[]>>;
  orBefore: FilterGroup[];
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
}

// SciCat stores these as arrays on a dataset, so a dataset can match several values at once
export type MultiField = "instruments" | "techniques" | "proposals" | "keywords";
export const MULTI_FIELDS: MultiField[] = ["instruments", "techniques", "proposals", "keywords"];

export type FilterGroup = "types" | "instruments" | "techniques" | "proposals" | "keywords" | "storage" | "date" | "conds";
export const FILTER_GROUPS: FilterGroup[] = ["types", "instruments", "techniques", "proposals", "keywords", "storage", "date", "conds"];

export type FacetField = "types" | "instruments" | "techniques" | "proposals" | "keywords" | "storage";
export interface FacetOption {
  value: string;
  label: string;
  hint?: string;
}
// One record of SciCat's metadataKeys collection: no unit, range or type is stored, so none can be offered up front
export interface MetaKeyInfo {
  key: string;
  humanReadableName: string;
  usageCount: number;
}
