import { mirrorTransport } from "@/lib/mirror/transport";

/**
 * Mirror-mode api module — swapped in by vite.config.ts when
 * VITE_DATA_SOURCE=firestore (alias @/lib/api). Reads the Firestore documents
 * the backend pushes; every write is rejected by the transport.
 */
export const IS_DEMO = false;
export const IS_MIRROR = true;

export const api = {
  get: <T>(path: string) => mirrorTransport.request<T>("GET", path),
  post: <T>(path: string, body: unknown) => mirrorTransport.request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => mirrorTransport.request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => mirrorTransport.request<T>("PUT", path, body),
  delete: <T>(path: string) => mirrorTransport.request<T>("DELETE", path),
  list: <T>(path: string) => mirrorTransport.list<T>(path),
};

export function downloadExport(
  _format: "csv" | "json",
  _filters: { modelId?: number; categoryId?: number },
): void {
  throw new Error("Read-only mirror — export from the desktop app.");
}
