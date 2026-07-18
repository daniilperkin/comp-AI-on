import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AppNotification,
  Category,
  LeaderboardEntry,
  LogEntry,
  LogEntryInput,
  MatrixData,
  Model,
  OverviewStats,
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
  statsLeaderboard: ["stats", "leaderboard"] as const,
  statsMatrix: ["stats", "matrix"] as const,
  settings: ["settings"] as const,
  notifications: ["notifications"] as const,
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

export function useStatsOverview() {
  return useQuery({
    queryKey: queryKeys.statsOverview,
    queryFn: () => api.get<OverviewStats>("/stats/overview"),
    staleTime: STALE_DEFAULT,
  });
}

export function useStatsTimeline() {
  return useQuery({
    queryKey: queryKeys.statsTimeline,
    queryFn: () => api.get<TimelinePoint[]>("/stats/timeline"),
    staleTime: STALE_DEFAULT,
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
    refetchInterval: false,
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
