import type {
  Category,
  CompareModelStat,
  CompareResult,
  LeaderboardEntry,
  LogEntry,
  LogEntryInput,
  MatrixData,
  Model,
  OverviewStats,
  RecommendationEntry,
  RecommendationResult,
  SpendData,
  TimelinePoint,
} from "@/types";
import { buildDemoDb, type DemoDb } from "./data";

/**
 * Demo transport: answers every API call the app makes from an in-browser
 * dataset, so the built SPA runs on GitHub Pages with no backend. Writes are
 * real (in-memory + localStorage) — the demo is a sandbox, not a mock.
 *
 * Only bundled when VITE_DATA_SOURCE=demo; the production app tree-shakes it.
 */

const STORAGE_KEY = "companion-demo-db-v1";
const LATENCY_MS = 120;
const DAY = 86_400_000;

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

let db: DemoDb | null = null;

function getDb(): DemoDb {
  if (db) return db;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      db = JSON.parse(raw) as DemoDb;
      return db;
    }
  } catch {
    // corrupted storage — fall through to a fresh dataset
  }
  db = buildDemoDb();
  persist();
  return db;
}

function persist(): void {
  try {
    if (db) localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // storage full / private mode — the demo still works in memory
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function modelMap(): Map<number, Model> {
  return new Map(getDb().models.map((m) => [m.id, m]));
}

function costOf(entry: LogEntry, models: Map<number, Model>): number | null {
  if (entry.cost_usd != null) return entry.cost_usd;
  const model = entry.model_id != null ? models.get(entry.model_id) : undefined;
  if (
    !model ||
    entry.input_tokens == null ||
    entry.output_tokens == null ||
    model.input_price_per_mtok == null ||
    model.output_price_per_mtok == null
  ) {
    return null;
  }
  return (
    (entry.input_tokens / 1e6) * model.input_price_per_mtok +
    (entry.output_tokens / 1e6) * model.output_price_per_mtok
  );
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function numParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function filterLogs(params: URLSearchParams): LogEntry[] {
  const modelId = numParam(params, "model_id");
  const categoryId = numParam(params, "category_id");
  const unrated = params.get("unrated") === "true";
  const origin = params.get("origin");
  let rows = getDb().logs;
  if (modelId !== null) rows = rows.filter((e) => e.model_id === modelId);
  if (categoryId !== null) rows = rows.filter((e) => e.category_id === categoryId);
  if (unrated) rows = rows.filter((e) => e.quality_score == null);
  if (origin) rows = rows.filter((e) => e.origin === origin);
  return [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function windowLogs(days: number | null): LogEntry[] {
  if (days === null) return getDb().logs;
  const cutoff = Date.now() - days * DAY;
  return getDb().logs.filter((e) => new Date(e.created_at + "Z").getTime() >= cutoff);
}

function statsOverview(): OverviewStats {
  const models = modelMap();
  const logs = getDb().logs;
  const rated = logs.filter((e) => e.quality_score != null);
  const withOutcome = logs.filter((e) => e.outcome != null);
  const solved = withOutcome.filter((e) => e.outcome === "solved").length;
  const avg = rated.length
    ? rated.reduce((sum, e) => sum + (e.quality_score as number), 0) / rated.length
    : null;

  const costSum = (rows: LogEntry[]) =>
    Number(
      rows
        .reduce((sum, e) => sum + (costOf(e, models) ?? 0), 0)
        .toFixed(6),
    );

  const byModel = new Map<number, { sum: number; entries: number }>();
  for (const e of rated) {
    if (e.model_id == null) continue;
    const bucket = byModel.get(e.model_id) ?? { sum: 0, entries: 0 };
    bucket.sum += e.quality_score as number;
    bucket.entries += 1;
    byModel.set(e.model_id, bucket);
  }
  const topModels = [...byModel.entries()]
    .map(([id, bucket]) => ({
      model: models.get(id) as Model,
      avg_quality: Number((bucket.sum / bucket.entries).toFixed(2)),
      entries: bucket.entries,
    }))
    .filter((row) => row.model)
    .sort((a, b) => b.avg_quality - a.avg_quality)
    .slice(0, 3);

  return {
    total_entries: logs.length,
    avg_quality: avg === null ? null : Number(avg.toFixed(2)),
    success_rate: withOutcome.length ? Number((solved / withOutcome.length).toFixed(2)) : null,
    last_7_days: logs.filter((e) => new Date(e.created_at + "Z").getTime() >= Date.now() - 7 * DAY)
      .length,
    total_cost_30d: costSum(windowLogs(30)),
    total_cost_all_time: costSum(logs),
    top_models: topModels,
  };
}

function statsTimeline(days: number | null): TimelinePoint[] {
  const buckets = new Map<string, { count: number; sum: number; rated: number }>();
  for (const e of windowLogs(days)) {
    const key = dayKey(e.created_at);
    const bucket = buckets.get(key) ?? { count: 0, sum: 0, rated: 0 };
    bucket.count += 1;
    if (e.quality_score != null) {
      bucket.sum += e.quality_score;
      bucket.rated += 1;
    }
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, bucket]) => ({
      date,
      count: bucket.count,
      avg_quality: bucket.rated ? Number((bucket.sum / bucket.rated).toFixed(2)) : null,
    }));
}

function statsLeaderboard(): LeaderboardEntry[] {
  const models = modelMap();
  const groups = new Map<number, LogEntry[]>();
  for (const e of getDb().logs) {
    if (e.model_id == null) continue;
    groups.set(e.model_id, [...(groups.get(e.model_id) ?? []), e]);
  }
  return [...groups.entries()]
    .map(([id, rows]) => {
      const rated = rows.filter((e) => e.quality_score != null);
      const withOutcome = rows.filter((e) => e.outcome != null);
      const solved = withOutcome.filter((e) => e.outcome === "solved").length;
      return {
        model: models.get(id) as Model,
        avg_quality: rated.length
          ? Number((rated.reduce((s, e) => s + (e.quality_score as number), 0) / rated.length).toFixed(2))
          : null,
        entries: rows.length,
        success_rate: withOutcome.length ? Number((solved / withOutcome.length).toFixed(2)) : null,
        total_cost: Number(rows.reduce((s, e) => s + (costOf(e, models) ?? 0), 0).toFixed(6)),
      };
    })
    .filter((row) => row.model)
    .sort((a, b) => (b.avg_quality ?? -1) - (a.avg_quality ?? -1));
}

function statsMatrix(): MatrixData {
  const models = getDb().models.filter((m) => m.is_active);
  const categories = getDb().categories;
  const cells = new Map<string, { sum: number; entries: number }>();
  for (const e of getDb().logs) {
    if (e.model_id == null || e.category_id == null || e.quality_score == null) continue;
    const key = `${e.model_id}:${e.category_id}`;
    const bucket = cells.get(key) ?? { sum: 0, entries: 0 };
    bucket.sum += e.quality_score;
    bucket.entries += 1;
    cells.set(key, bucket);
  }
  const modelById = new Map(models.map((m) => [m.id, m]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  return {
    models,
    categories,
    cells: [...cells.entries()]
      .map(([key, bucket]) => {
        const [modelId, categoryId] = key.split(":").map(Number);
        const model = modelById.get(modelId);
        const category = categoryById.get(categoryId);
        if (!model || !category) return null;
        return {
          model_id: modelId,
          model_name: model.name,
          category_id: categoryId,
          category_name: category.name,
          category_color: category.color,
          avg_quality: Number((bucket.sum / bucket.entries).toFixed(2)),
          entries: bucket.entries,
        };
      })
      .filter((cell): cell is NonNullable<typeof cell> => cell !== null),
  };
}

function statsSpend(days: number | null): SpendData {
  const models = modelMap();
  const daily = new Map<string, number>();
  const byModel = new Map<number | null, { cost: number; entries: number }>();
  for (const e of windowLogs(days)) {
    const cost = costOf(e, models);
    if (cost !== null) {
      const key = dayKey(e.created_at);
      daily.set(key, (daily.get(key) ?? 0) + cost);
    }
    const bucket = byModel.get(e.model_id) ?? { cost: 0, entries: 0 };
    bucket.entries += 1;
    if (cost !== null) bucket.cost += cost;
    byModel.set(e.model_id, bucket);
  }
  return {
    daily: [...daily.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, cost]) => ({ date, cost: Number(cost.toFixed(6)) })),
    by_model: [...byModel.entries()]
      .map(([modelId, bucket]) => ({
        model_id: modelId,
        model_name: (modelId != null && models.get(modelId)?.name) || "Unknown",
        total_cost: Number(bucket.cost.toFixed(6)),
        entries: bucket.entries,
      }))
      .sort((a, b) => b.total_cost - a.total_cost),
  };
}

function recommend(params: URLSearchParams): RecommendationResult {
  const categoryId = numParam(params, "category_id");
  const topN = numParam(params, "top_n") ?? 5;
  const models = modelMap();
  const rated = getDb().logs.filter((e) => e.quality_score != null && e.model_id != null);
  const globalAvg = rated.length
    ? rated.reduce((s, e) => s + (e.quality_score as number), 0) / rated.length
    : 5;
  const scoped = categoryId !== null ? rated.filter((e) => e.category_id === categoryId) : rated;

  const groups = new Map<number, LogEntry[]>();
  for (const e of scoped) groups.set(e.model_id as number, [...(groups.get(e.model_id as number) ?? []), e]);

  const K = 5;
  const scored: RecommendationEntry[] = [...groups.entries()]
    .map(([id, rows]) => {
      const v = rows.length;
      const avg = rows.reduce((s, e) => s + (e.quality_score as number), 0) / v;
      const solved = rows.filter((e) => e.outcome === "solved").length;
      const shrunk = (v / (v + K)) * avg + (K / (v + K)) * globalAvg;
      return {
        model: models.get(id) as Model,
        avg_quality: Number(avg.toFixed(2)),
        entries: v,
        success_rate: Number((solved / v).toFixed(2)),
        score: Number(shrunk.toFixed(2)),
      };
    })
    .filter((row) => row.model)
    .sort((a, b) => b.score - a.score || b.success_rate - a.success_rate || b.entries - a.entries)
    .slice(0, topN);

  return {
    category_id: categoryId,
    category_name:
      categoryId !== null
        ? getDb().categories.find((c) => c.id === categoryId)?.name ?? null
        : null,
    recommendations: scored,
    global_avg_quality: Number(globalAvg.toFixed(2)),
  };
}

function compare(params: URLSearchParams): CompareResult {
  const raw = params.get("model_ids") ?? "";
  const ids = raw
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));
  if (ids.length < 2) throw new Error("Provide at least 2 model IDs to compare");

  const models = modelMap();
  const stats: CompareModelStat[] = ids.map((id) => {
    const model = models.get(id);
    if (!model) throw new Error(`Models not found: ${id}`);
    const rows = getDb().logs.filter((e) => e.model_id === id);
    const rated = rows.filter((e) => e.quality_score != null);
    const withOutcome = rows.filter((e) => e.outcome != null);
    const solved = withOutcome.filter((e) => e.outcome === "solved").length;
    const latencies = rows.filter((e) => e.latency_ms != null);
    const costs = rows.map((e) => e.cost_usd).filter((c): c is number => c != null);

    const byCategory = new Map<number, LogEntry[]>();
    for (const e of rows) {
      if (e.category_id == null) continue;
      byCategory.set(e.category_id, [...(byCategory.get(e.category_id) ?? []), e]);
    }

    return {
      model,
      avg_quality: rated.length
        ? Number((rated.reduce((s, e) => s + (e.quality_score as number), 0) / rated.length).toFixed(2))
        : null,
      entries: rows.length,
      success_rate: rows.length ? Number((solved / rows.length).toFixed(2)) : null,
      avg_latency_ms: latencies.length
        ? Math.round(latencies.reduce((s, e) => s + (e.latency_ms as number), 0) / latencies.length)
        : null,
      total_cost_usd: costs.length ? Number(costs.reduce((s, c) => s + c, 0).toFixed(4)) : null,
      per_category: [...byCategory.entries()]
        .map(([categoryId, catRows]) => {
          const category = getDb().categories.find((c) => c.id === categoryId);
          const catRated = catRows.filter((e) => e.quality_score != null);
          if (!category) return null;
          return {
            category_id: categoryId,
            category_name: category.name,
            category_color: category.color,
            avg_quality: catRated.length
              ? Number((catRated.reduce((s, e) => s + (e.quality_score as number), 0) / catRated.length).toFixed(2))
              : null,
            entries: catRows.length,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((a, b) => (a.category_name < b.category_name ? -1 : 1)),
    };
  });

  return { models: stats };
}

function exportLogs(format: "csv" | "json", params: URLSearchParams): void {
  const rows = filterLogs(params);
  let content: string;
  let type: string;
  if (format === "json") {
    content = JSON.stringify(rows, null, 2);
    type = "application/json";
  } else {
    const headers = [
      "id", "created_at", "model", "category", "task_description", "quality_score", "outcome",
      "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens",
      "reasoning_tokens", "cost_usd", "latency_ms", "notes",
    ];
    const models = modelMap();
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.join(",")];
    for (const e of rows) {
      lines.push(
        [
          e.id,
          e.created_at,
          (e.model_id != null && models.get(e.model_id)?.name) || e.model_name_text || "",
          e.category_id != null
            ? getDb().categories.find((c) => c.id === e.category_id)?.name ?? ""
            : "",
          e.task_description,
          e.quality_score,
          e.outcome,
          e.input_tokens,
          e.output_tokens,
          e.cache_read_tokens,
          e.cache_write_tokens,
          e.reasoning_tokens,
          e.cost_usd,
          e.latency_ms,
          e.notes,
        ]
          .map(escape)
          .join(","),
      );
    }
    content = lines.join("\n");
    type = "text/csv";
  }
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `companion-logs.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadDemoExport(
  format: "csv" | "json",
  filters: { modelId?: number; categoryId?: number },
): void {
  const params = new URLSearchParams();
  if (filters.modelId != null) params.set("model_id", String(filters.modelId));
  if (filters.categoryId != null) params.set("category_id", String(filters.categoryId));
  exportLogs(format, params);
}

export interface Transport {
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
  list<T>(path: string): Promise<{ data: T; total: number }>;
}

export const demoTransport: Transport = {
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    await wait();
    const [rawPath, rawQuery] = path.split("?");
    const pathname = rawPath.replace(/\/+$/, "") || "/";
    const params = new URLSearchParams(rawQuery ?? "");
    const data = getDb();
    const payload = (body ?? {}) as LogEntryInput & Record<string, unknown>;

    const logMatch = pathname.match(/^\/logs\/(\d+)$/);
    if (pathname === "/health") return { status: "ok", db: "demo" } as T;

    if (pathname === "/logs") {
      if (method === "GET") {
        const limit = numParam(params, "limit") ?? 100;
        const offset = numParam(params, "offset") ?? 0;
        return clone(filterLogs(params).slice(offset, offset + limit)) as T;
      }
      if (method === "POST") {
        const hasContent = [payload.model_id, payload.model_name_text, payload.category_id, payload.category_name_text, payload.task_description].some(
          (v) => v !== undefined && v !== null && v !== "",
        );
        if (!hasContent) throw new Error("Provide at least a model, category, or task description");
        const entry: LogEntry = {
          id: data.seq.logs++,
          created_at: new Date().toISOString().replace("Z", ""),
          model_id: payload.model_id ?? null,
          model_name_text: payload.model_name_text ?? null,
          category_id: payload.category_id ?? null,
          category_name_text: payload.category_name_text ?? null,
          task_description: payload.task_description ?? null,
          quality_score: payload.quality_score ?? null,
          outcome: payload.outcome ?? null,
          input_tokens: payload.input_tokens ?? null,
          output_tokens: payload.output_tokens ?? null,
          cache_read_tokens: payload.cache_read_tokens ?? null,
          cache_write_tokens: payload.cache_write_tokens ?? null,
          reasoning_tokens: payload.reasoning_tokens ?? null,
          cost_usd: payload.cost_usd ?? null,
          latency_ms: payload.latency_ms ?? null,
          notes: payload.notes ?? null,
          origin: "manual",
        };
        data.logs.unshift(entry);
        persist();
        return clone(entry) as T;
      }
    }

    if (logMatch) {
      const id = Number(logMatch[1]);
      const index = data.logs.findIndex((e) => e.id === id);
      if (index === -1) throw new Error("Log entry not found");
      if (method === "GET") return clone(data.logs[index]) as T;
      if (method === "PATCH") {
        const next = { ...data.logs[index], ...payload } as LogEntry;
        data.logs[index] = next;
        persist();
        return clone(next) as T;
      }
      if (method === "DELETE") {
        data.logs.splice(index, 1);
        persist();
        return undefined as T;
      }
    }

    const modelMatch = pathname.match(/^\/models\/(\d+)$/);
    if (pathname === "/models") {
      if (method === "GET") return clone([...data.models].sort((a, b) => (a.name < b.name ? -1 : 1))) as T;
      if (method === "POST") {
        const model: Model = {
          id: data.seq.models++,
          name: String(payload.name ?? "Untitled model"),
          kind: (payload.kind as Model["kind"]) ?? "web",
          vendor: (payload.vendor as string | null) ?? null,
          is_active: payload.is_active !== false,
          input_price_per_mtok: (payload.input_price_per_mtok as number | null) ?? null,
          output_price_per_mtok: (payload.output_price_per_mtok as number | null) ?? null,
          created_at: new Date().toISOString().replace("Z", ""),
        };
        data.models.push(model);
        persist();
        return clone(model) as T;
      }
    }
    if (modelMatch) {
      const id = Number(modelMatch[1]);
      const index = data.models.findIndex((m) => m.id === id);
      if (index === -1) throw new Error("Model not found");
      if (method === "PATCH") {
        data.models[index] = { ...data.models[index], ...(payload as Partial<Model>) };
        persist();
        return clone(data.models[index]) as T;
      }
      if (method === "DELETE") {
        data.models.splice(index, 1);
        persist();
        return undefined as T;
      }
    }

    const categoryMatch = pathname.match(/^\/categories\/(\d+)$/);
    if (pathname === "/categories") {
      if (method === "GET") return clone([...data.categories].sort((a, b) => (a.name < b.name ? -1 : 1))) as T;
      if (method === "POST") {
        const category: Category = {
          id: data.seq.categories++,
          name: String(payload.name ?? "Untitled category"),
          color: (payload.color as string | null) ?? null,
          created_at: new Date().toISOString().replace("Z", ""),
        };
        data.categories.push(category);
        persist();
        return clone(category) as T;
      }
    }
    if (categoryMatch) {
      const id = Number(categoryMatch[1]);
      const index = data.categories.findIndex((c) => c.id === id);
      if (index === -1) throw new Error("Category not found");
      if (method === "PATCH") {
        data.categories[index] = { ...data.categories[index], ...(payload as Partial<Category>) };
        persist();
        return clone(data.categories[index]) as T;
      }
      if (method === "DELETE") {
        data.categories.splice(index, 1);
        persist();
        return undefined as T;
      }
    }

    if (pathname === "/stats/overview") return clone(statsOverview()) as T;
    if (pathname === "/stats/timeline") return clone(statsTimeline(numParam(params, "days"))) as T;
    if (pathname === "/stats/leaderboard") return clone(statsLeaderboard()) as T;
    if (pathname === "/stats/matrix") return clone(statsMatrix()) as T;
    if (pathname === "/stats/spend") return clone(statsSpend(numParam(params, "days"))) as T;
    if (pathname === "/stats/monthly") {
      const month = params.get("month") ?? new Date().toISOString().slice(0, 7);
      const rows = data.logs.filter((e) => e.created_at.slice(0, 7) === month);
      const models = modelMap();
      const byModel = new Map<number | null, LogEntry[]>();
      for (const e of rows) byModel.set(e.model_id, [...(byModel.get(e.model_id) ?? []), e]);
      return clone({
        month,
        total_cost: Number(rows.reduce((s, e) => s + (costOf(e, models) ?? 0), 0).toFixed(6)),
        unknown_cost_entries: rows.filter((e) => costOf(e, models) === null).length,
        models: [...byModel.entries()].map(([modelId, group]) => ({
          model_id: modelId,
          model_name: (modelId != null && models.get(modelId)?.name) || "Unknown",
          entries: group.length,
          input_tokens: group.reduce((s, e) => s + (e.input_tokens ?? 0), 0),
          output_tokens: group.reduce((s, e) => s + (e.output_tokens ?? 0), 0),
          total_cost: Number(group.reduce((s, e) => s + (costOf(e, models) ?? 0), 0).toFixed(6)),
          avg_quality: null,
          unknown_cost_entries: 0,
        })),
      }) as T;
    }

    if (pathname === "/settings") {
      if (method === "GET") return clone(data.settings) as T;
      if (method === "PUT") {
        for (const [key, value] of Object.entries(payload)) {
          data.settings[key] = typeof value === "boolean" ? String(value) : String(value ?? "");
        }
        persist();
        return clone(data.settings) as T;
      }
    }

    if (pathname === "/notifications") return [] as T;
    if (pathname === "/notifications/test") return { ok: true } as T;
    if (pathname === "/notifications/mark-all-shown") return { ok: true } as T;
    if (/^\/notifications\/\d+\/shown$/.test(pathname)) return { ok: true } as T;

    if (pathname === "/sync/status")
      return { configured: false, enabled: false, has_api_key: false, last_sync_at: null } as T;
    if (pathname === "/sync/hermes/status")
      return {
        enabled: false,
        hermes_home: "(demo — no local Hermes in the browser)",
        profiles_found: [],
        last_sync_at: null,
      } as T;
    if (pathname === "/sync/run" || pathname === "/sync/hermes/run")
      throw new Error("Demo mode — syncing needs the local backend.");

    if (pathname === "/recommend") return clone(recommend(params)) as T;
    if (pathname === "/compare") return clone(compare(params)) as T;

    if (/^\/logs\/export\/(csv|json)$/.test(pathname)) {
      exportLogs(pathname.endsWith("csv") ? "csv" : "json", params);
      return undefined as T;
    }

    throw new Error(`Demo transport: no route for ${method} ${pathname}`);
  },

  async list<T>(path: string): Promise<{ data: T; total: number }> {
    await wait();
    const [rawPath, rawQuery] = path.split("?");
    if (rawPath.replace(/\/+$/, "") === "/logs") {
      const rows = filterLogs(new URLSearchParams(rawQuery ?? ""));
      const params = new URLSearchParams(rawQuery ?? "");
      const limit = numParam(params, "limit") ?? 100;
      const offset = numParam(params, "offset") ?? 0;
      return { data: clone(rows.slice(offset, offset + limit)) as T, total: rows.length };
    }
    const data = await this.request<T>("GET", path);
    return { data, total: Array.isArray(data) ? data.length : 1 };
  },
};
