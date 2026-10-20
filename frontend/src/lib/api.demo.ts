import { demoTransport } from "@/lib/demo/transport";
import { downloadDemoExport } from "@/lib/demo/transport";

/**
 * Demo-mode api module — swapped in by vite.config.ts when
 * VITE_DATA_SOURCE=demo (alias @/lib/api). Same surface as lib/api.ts, backed
 * by the in-browser fixtures instead of the FastAPI server.
 */
export const IS_DEMO = true;

export const api = {
  get: <T>(path: string) => demoTransport.request<T>("GET", path),
  post: <T>(path: string, body: unknown) => demoTransport.request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => demoTransport.request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => demoTransport.request<T>("PUT", path, body),
  delete: <T>(path: string) => demoTransport.request<T>("DELETE", path),
  list: <T>(path: string) => demoTransport.list<T>(path),
};

export function downloadExport(
  format: "csv" | "json",
  filters: { modelId?: number; categoryId?: number },
): void {
  downloadDemoExport(format, filters);
}
