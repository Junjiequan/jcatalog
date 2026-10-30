import { scicatApi } from "./scicat";
import type { CatalogApi } from "./types";

// The mock lives in /mock, outside the app. This lookup is the only link to it: if the folder is deleted it finds nothing,
// and the app uses the SciCat backend (VITE_SCICAT_URL). VITE_API_MODE=scicat chooses the backend even while the mock exists.
const found = import.meta.glob<{ mockApi: CatalogApi }>("../../mock/index.ts", { eager: true });
const mockApi = Object.values(found)[0]?.mockApi;

export const API_MODE = (import.meta.env.VITE_API_MODE as string | undefined) === "scicat" || !mockApi ? "scicat" : "mock";
export const api: CatalogApi = API_MODE === "mock" ? mockApi! : scicatApi;

export type { CatalogApi, CreateInput, DatasetPatch, Page, Count } from "./types";
