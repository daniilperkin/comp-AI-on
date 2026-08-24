import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type {
  AppNotification,
  Category,
  CompareResult,
  LeaderboardEntry,
  LogEntry,
  LogEntryInput,
  MatrixData,
  Model,
  OverviewStats,
  RecommendationResult,
  SpendData,
  TimelinePoint,
} from "@/types";

export const queryKeys = {
  models: ["models"] as const,
  categories: ["categories"] as const,
  logs: (params?: { limit?: number; offset?: number; modelId?: number; categoryId?: number }) =>
    ["logs", params ?? {}] as const,
  logsTotal: ["logs", "total"] as const,
  statsOverview: ["stats", "overview"] as const,
  statsTimeline: ["stats", "timeline"] as const,
  statsSpend: ["stats", "spend"] as const,
  statsLeaderboard: ["stats", "leaderboard"] as const,
  statsMatrix: ["stats", "matrix"] as const,
  settings: ["settings"] as const,
  notifications: ["notifications"] as const,
  recommend: (categoryId?: number) => ["recommend", categoryId ?? "all"] as const,
  compare: (modelIds: string) => ["compare", modelIds] as const,
};

const STALE_FOREVER = Infinity;
const STALE_DEFAULT = 30_000;

export function useModels() {
  return useQuery({
    queryKey: queryKeys.models,
    queryFn: () => api.get<Model[]>("/models"),
    staleTime: STALE_DEFAULT,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.get<Category[]>("/categories"),
    staleTime: STALE_DEFAULT,
  });
}

export function useModelsCategories() {
  const models = useModels();
  const categories = useCategories();
  return {
    models: models.data ?? [],
    categories: categories.data ?? [],
    modelsLoading: models.isLoading,
    categoriesLoading: categories.isLoading,
    modelsError: models.error,
    categoriesError: categories.error,
  };
}

interface LogsParams {
  limit?: number;
  offset?: number;
  modelId?: number;
  categoryId?: number;
}

function buildLogsQuery(params: LogsParams = {}) {
  const search = new URLSearchParams();
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  if (params.modelId != null) search.set("model_id", String(params.modelId));
  if (params.categoryId != null) search.set("category_id", String(params.categoryId));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function useLogs(params?: LogsParams) {
  return useQuery({
    queryKey: queryKeys.logs(params),
    queryFn: () => api.get<LogEntry[]>(`/logs${buildLogsQuery(params ?? {})}`),
    staleTime: STALE_DEFAULT,
  });
}

export const LOGS_PAGE_SIZE = 50;

/**
 * Paged logs. The backend reports the filtered row count in the X-Total-Count
 * response header (see backend/routers/logs.py), which request() returns via
 * the headers — so callers can page through everything instead of silently
 * capping at one large limit.
 */
export function useLogsPaged(
  params?: Omit<LogsParams, "limit" | "offset">,
) {
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: queryKeys.logs({ ...params, offset: page * LOGS_PAGE_SIZE }),
    queryFn: async () => {
      const res = await fetch(
        `/api/logs${buildLogsQuery({
          ...params,
          limit: LOGS_PAGE_SIZE,
          offset: page * LOGS_PAGE_SIZE,
        })}`,
        { headers: { "Content-Type": "application/json" } },
      );
      if (!res.ok) throw new Error(res.statusText);
      return {
        entries: (await res.json()) as LogEntry[],
        total: Number(res.headers.get("X-Total-Count") ?? "0"),
      };
    },
    staleTime: STALE_DEFAULT,
    placeholderData: (prev) => prev,
  });

  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / LOGS_PAGE_SIZE));

  return {
    entries: query.data?.entries ?? [],
    total,
    page,
    pageCount,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    prevPage: () => setPage((p) => Math.max(0, p - 1)),
    nextPage: () => setPage((p) => Math.min(pageCount - 1, p + 1)),
  };
}

export function useStatsOverview() {
  return useQuery({
    queryKey: queryKeys.statsOverview,
    queryFn: () => api.get<OverviewStats>("/stats/overview"),
    staleTime: STALE_DEFAULT,
  });
}

export function useStatsTimeline(days?: number) {
  return useQuery({
    queryKey: [...queryKeys.statsTimeline, days ?? null],
    queryFn: () =>
      api.get<TimelinePoint[]>(days ? `/stats/timeline?days=${days}` : "/stats/timeline"),
    staleTime: STALE_DEFAULT,
    placeholderData: (prev) => prev,
  });
}

export function useStatsLeaderboard() {
  return useQuery({
    queryKey: queryKeys.statsLeaderboard,
    queryFn: () => api.get<LeaderboardEntry[]>("/stats/leaderboard"),
    staleTime: STALE_DEFAULT,
  });
}

export function useStatsMatrix() {
  return useQuery({
    queryKey: queryKeys.statsMatrix,
    queryFn: () => api.get<MatrixData>("/stats/matrix"),
    staleTime: STALE_DEFAULT,
  });
}

export function useStatsSpend(days?: number) {
  return useQuery({
    queryKey: [...queryKeys.statsSpend, days ?? null],
    queryFn: () =>
      api.get<SpendData>(days ? `/stats/spend?days=${days}` : "/stats/spend"),
    staleTime: STALE_DEFAULT,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api.get<Record<string, string>>("/settings"),
    staleTime: STALE_FOREVER,
  });
}

export function useCreateLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LogEntryInput) => api.post<LogEntry>("/logs", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logs"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useUpdateLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: LogEntryInput }) =>
      api.patch<LogEntry>(`/logs/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logs"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useDeleteLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/logs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logs"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useCreateModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; kind: string; vendor: string | null; is_active: boolean }) =>
      api.post<Model>("/models", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.models });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useUpdateModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<Model> }) =>
      api.patch<Model>(`/models/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.models });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useDeleteModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/models/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.models });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, string | boolean>) =>
      api.put<Record<string, string>>("/settings", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}

export function usePendingNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => api.get<AppNotification[]>("/notifications"),
    staleTime: 0,
    refetchInterval: 60_000,
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/shown`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useDismissAllNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/notifications/mark-all-shown", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useRecommend(categoryId?: number) {
  return useQuery({
    queryKey: queryKeys.recommend(categoryId),
    queryFn: () =>
      api.get<RecommendationResult>(
        `/recommend${categoryId != null ? `?category_id=${categoryId}` : ""}`
      ),
    staleTime: 60_000,
  });
}

export function useCompare(modelIds: string) {
  return useQuery({
    queryKey: queryKeys.compare(modelIds),
    queryFn: () => api.get<CompareResult>(`/compare?model_ids=${modelIds}`),
    enabled: modelIds.length > 0,
    staleTime: 60_000,
  });
}

// ---- OpenRouter usage sync ----

export interface SyncStatus {
  configured: boolean;
  enabled: boolean;
  has_api_key: boolean;
  last_sync_at: string | null;
}

export interface SyncResult {
  ok: boolean;
  fetched: number;
  created: number;
  skipped_existing: number;
  errors: number;
  last_sync_at?: string;
  status?: SyncStatus;
  error?: string;
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync", "status"],
    queryFn: () => api.get<SyncStatus>("/sync/status"),
    staleTime: 30_000,
  });
}

export function useRunSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (daysBack: number) =>
      api.post<SyncResult>("/sync/run", { days_back: daysBack }),
    onSuccess: () => {
      // Imported entries change logs + all stats.
      qc.invalidateQueries({ queryKey: ["logs"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["sync"] });
    },
  });
}
