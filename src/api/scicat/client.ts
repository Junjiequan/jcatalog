// A thin fetch wrapper for the SciCat backend: base URL, bearer token, JSON in and out, typed errors.

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

const BASE = ((import.meta.env.VITE_SCICAT_URL as string | undefined) ?? "http://localhost:3000/api/v4").replace(/\/$/, "");
let token: string | undefined;
export const setToken = (t?: string) => (token = t);

export async function request<T>(path: string, init: RequestInit & { query?: Record<string, unknown> } = {}): Promise<T> {
  const { query, headers, ...rest } = init;
  const url = new URL(BASE + path);
  // SciCat takes JSON-encoded filter objects as query parameters
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  const res = await fetch(url, {
    ...rest,
    headers: { Accept: "application/json", ...(rest.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new ApiError(res.status, (body as { message?: string })?.message ?? `${res.status} ${res.statusText}`, body);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const get = <T>(path: string, query?: Record<string, unknown>, signal?: AbortSignal) => request<T>(path, { query, signal });
export const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const del = <T>(path: string) => request<T>(path, { method: "DELETE" });
