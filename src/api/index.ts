import { mockApi } from "./mock";
import { scicatApi } from "./scicat";
import type { CatalogApi } from "./types";

// VITE_API_MODE=scicat talks to a SciCat backend (VITE_SCICAT_URL); anything else uses the in-memory mock.
export const API_MODE = (import.meta.env.VITE_API_MODE as string | undefined) === "scicat" ? "scicat" : "mock";
export const api: CatalogApi = API_MODE === "scicat" ? scicatApi : mockApi;

export type { CatalogApi, CreateInput, DatasetPatch, Page, Count } from "./types";
