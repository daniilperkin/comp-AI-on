async function httpRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

const httpTransport = {
  request: <T>(method: string, path: string, body?: unknown) =>
    httpRequest<T>(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  list: async <T>(path: string) => {
    const res = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail ?? detail;
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(detail);
    }
    return {
      data: (await res.json()) as T,
      total: Number(res.headers.get("X-Total-Count") ?? "0"),
    };
  },
};

/**
 * Default (local) api module: talks to the FastAPI server on /api.
 *
 * The GitHub Pages demo build replaces this whole module via the `@/lib/api`
 * alias in vite.config.ts (lib/api.demo.ts, VITE_DATA_SOURCE=demo). Keeping it
 * a separate module (not a runtime switch) means the production build can
 * never accidentally bundle the demo fixtures.
 */
export const IS_DEMO = false;

export const api = {
  get: <T>(path: string) => httpTransport.request<T>("GET", path),
  post: <T>(path: string, body: unknown) => httpTransport.request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => httpTransport.request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => httpTransport.request<T>("PUT", path, body),
  delete: <T>(path: string) => httpTransport.request<T>("DELETE", path),
  /** Like get(), but also returns the filtered total from X-Total-Count. */
  list: <T>(path: string) => httpTransport.list<T>(path),
};

export function downloadExport(
  format: "csv" | "json",
  filters: {
    modelId?: number;
    categoryId?: number;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
    unrated?: boolean;
  },
): void {
  const params = new URLSearchParams();
  if (filters.modelId != null) params.set("model_id", String(filters.modelId));
  if (filters.categoryId != null) params.set("category_id", String(filters.categoryId));
  if (filters.q) params.set("q", filters.q);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.unrated) params.set("unrated", "true");
  const qs = params.toString();
  window.location.href = `/api/logs/export/${format}${qs ? `?${qs}` : ""}`;
}
