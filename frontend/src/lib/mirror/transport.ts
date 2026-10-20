import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { collection, doc, getDoc, getDocs, getFirestore } from "firebase/firestore";
import type {
  Category,
  CompareModelStat,
  CompareResult,
  LeaderboardEntry,
  LogEntry,
  MatrixData,
  Model,
  OverviewStats,
  RecommendationEntry,
  RecommendationResult,
  SpendData,
  TimelinePoint,
} from "@/types";
import type { Transport } from "@/lib/demo/transport";

/**
 * Firestore mirror transport: the read-only phone view. The backend pushes
 * rows + precomputed stats documents (see backend/firebase_mirror.py); this
 * transport only reads them. Built with VITE_DATA_SOURCE=firestore and a
 * VITE_FIREBASE_CONFIG JSON blob, deployed to Firebase Hosting.
 */

type Firestore = ReturnType<typeof getFirestore>;
type Auth = ReturnType<typeof getAuth>;

let db: Firestore | null = null;
let auth: Auth | null = null;

function services(): { db: Firestore; auth: Auth } {
  if (db && auth) return { db, auth };
  const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (!raw) throw new Error("Mirror build is missing VITE_FIREBASE_CONFIG.");
  const app = initializeApp(JSON.parse(raw) as Record<string, string>);
  db = getFirestore(app);
  auth = getAuth(app);
  return { db, auth };
}

async function withAuthRetry<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    if (code.includes("permission-denied")) {
      await signInWithPopup(services().auth, new GoogleAuthProvider());
      return op();
    }
    throw err;
  }
}

async function readDoc<T>(path: string): Promise<T> {
  const [name, id] = path.split("/");
  const snap = await withAuthRetry(() => getDoc(doc(services().db, name, id)));
  if (!snap.exists()) {
    throw new Error(`Mirror has no ${path} yet — run the mirror from the desktop app.`);
  }
  return snap.data() as T;
}

async function readCollection<T>(name: string): Promise<T[]> {
  const snap = await withAuthRetry(() => getDocs(collection(services().db, name)));
  return snap.docs.map((d) => d.data() as T);
}

function num(value: string | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function filterLogs(logs: LogEntry[], params: URLSearchParams): LogEntry[] {
  const modelId = num(params.get("model_id"));
  const categoryId = num(params.get("category_id"));
  const unrated = params.get("unrated") === "true";
  const origin = params.get("origin");
  let rows = logs;
  if (modelId !== null) rows = rows.filter((e) => e.model_id === modelId);
  if (categoryId !== null) rows = rows.filter((e) => e.category_id === categoryId);
  if (unrated) rows = rows.filter((e) => e.quality_score == null);
  if (origin) rows = rows.filter((e) => e.origin === origin);
  return [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function recommend(logs: LogEntry[], models: Model[], params: URLSearchParams): RecommendationResult {
  const categoryId = num(params.get("category_id"));
  const topN = num(params.get("top_n")) ?? 5;
  const rated = logs.filter((e) => e.quality_score != null && e.model_id != null);
  const globalAvg = rated.length
    ? rated.reduce((s, e) => s + (e.quality_score as number), 0) / rated.length
    : 5;
  const scoped = categoryId !== null ? rated.filter((e) => e.category_id === categoryId) : rated;
  const groups = new Map<number, LogEntry[]>();
  for (const e of scoped) groups.set(e.model_id as number, [...(groups.get(e.model_id as number) ?? []), e]);
  const byId = new Map(models.map((m) => [m.id, m]));
  const K = 5;
  const scored: RecommendationEntry[] = [...groups.entries()]
    .map(([id, rows]) => {
      const v = rows.length;
      const avg = rows.reduce((s, e) => s + (e.quality_score as number), 0) / v;
      const solved = rows.filter((e) => e.outcome === "solved").length;
      return {
        model: byId.get(id) as Model,
        avg_quality: Number(avg.toFixed(2)),
        entries: v,
        success_rate: Number((solved / v).toFixed(2)),
        score: Number(((v / (v + K)) * avg + (K / (v + K)) * globalAvg).toFixed(2)),
      };
    })
    .filter((row) => row.model)
    .sort((a, b) => b.score - a.score || b.success_rate - a.success_rate || b.entries - a.entries)
    .slice(0, topN);
  return {
    category_id: categoryId,
    category_name: null,
    recommendations: scored,
    global_avg_quality: Number(globalAvg.toFixed(2)),
  };
}

function compare(logs: LogEntry[], models: Model[], params: URLSearchParams): CompareResult {
  const ids = (params.get("model_ids") ?? "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));
  if (ids.length < 2) throw new Error("Provide at least 2 model IDs to compare");
  const byId = new Map(models.map((m) => [m.id, m]));
  const stats: CompareModelStat[] = ids.map((id) => {
    const model = byId.get(id);
    if (!model) throw new Error(`Models not found: ${id}`);
    const rows = logs.filter((e) => e.model_id === id);
    const rated = rows.filter((e) => e.quality_score != null);
    const withOutcome = rows.filter((e) => e.outcome != null);
    const solved = withOutcome.filter((e) => e.outcome === "solved").length;
    const latencies = rows.filter((e) => e.latency_ms != null);
    const costs = rows.map((e) => e.cost_usd).filter((c): c is number => c != null);
    return {
      model,
      avg_quality: rated.length
        ? Number((rated.reduce((s, e) => s + (e.quality_score as number), 0) / rated.length).toFixed(2))
        : null,
      entries: rows.length,
      success_rate: withOutcome.length ? Number((solved / withOutcome.length).toFixed(2)) : null,
      avg_latency_ms: latencies.length
        ? Math.round(latencies.reduce((s, e) => s + (e.latency_ms as number), 0) / latencies.length)
        : null,
      total_cost_usd: costs.length ? Number(costs.reduce((s, c) => s + c, 0).toFixed(4)) : null,
      per_category: [],
    };
  });
  return { models: stats };
}

const READ_ONLY = "Read-only mirror — edit entries in the desktop app.";

export const mirrorTransport: Transport = {
  async request<T>(method: string, path: string): Promise<T> {
    if (method !== "GET") throw new Error(READ_ONLY);
    const [rawPath, rawQuery] = path.split("?");
    const pathname = rawPath.replace(/\/+$/, "") || "/";
    const params = new URLSearchParams(rawQuery ?? "");

    if (pathname === "/health") return { status: "ok", db: "firestore" } as T;

    if (pathname === "/logs") {
      const logs = await readCollection<LogEntry>("logs");
      const rows = filterLogs(logs, params);
      const limit = num(params.get("limit")) ?? 100;
      const offset = num(params.get("offset")) ?? 0;
      return rows.slice(offset, offset + limit) as T;
    }

    if (pathname === "/models") {
      const models = await readCollection<Model>("models");
      return [...models].sort((a, b) => (a.name < b.name ? -1 : 1)) as T;
    }
    if (pathname === "/categories") {
      const categories = await readCollection<Category>("categories");
      return [...categories].sort((a, b) => (a.name < b.name ? -1 : 1)) as T;
    }

    if (pathname === "/stats/overview") return (await readDoc<OverviewStats>("meta/overview")) as T;
    if (pathname === "/stats/timeline") {
      return (await readDoc<{ points: TimelinePoint[] }>("meta/timeline")).points as T;
    }
    if (pathname === "/stats/leaderboard") {
      return (await readDoc<{ entries: LeaderboardEntry[] }>("meta/leaderboard")).entries as T;
    }
    if (pathname === "/stats/matrix") return (await readDoc<MatrixData>("meta/matrix")) as T;
    if (pathname === "/stats/spend") return (await readDoc<SpendData>("meta/spend")) as T;
    if (pathname === "/stats/monthly") return (await readDoc("meta/monthly")) as T;

    if (pathname === "/settings") {
      const snap = await withAuthRetry(() => getDocs(collection(services().db, "settings")));
      const out: Record<string, string> = {};
      snap.docs.forEach((d) => {
        out[d.id] = String((d.data() as { value?: string }).value ?? "");
      });
      return out as T;
    }

    if (pathname === "/notifications") return [] as T;
    if (pathname === "/sync/status")
      return { configured: true, enabled: false, has_api_key: false, last_sync_at: null } as T;
    if (pathname === "/sync/hermes/status")
      return {
        enabled: false,
        hermes_home: "(mirror — no local Hermes in the browser)",
        profiles_found: [],
        last_sync_at: null,
      } as T;
    if (pathname.startsWith("/sync/")) throw new Error("Mirror is read-only — sync runs on the desktop.");

    if (pathname === "/recommend" || pathname === "/compare") {
      const [logs, models] = await Promise.all([
        readCollection<LogEntry>("logs"),
        readCollection<Model>("models"),
      ]);
      return (pathname === "/recommend" ? recommend(logs, models, params) : compare(logs, models, params)) as T;
    }

    throw new Error(`Mirror transport: no route for ${method} ${pathname}`);
  },

  async list<T>(path: string): Promise<{ data: T; total: number }> {
    const [rawPath, rawQuery] = path.split("?");
    if (rawPath.replace(/\/+$/, "") === "/logs") {
      const logs = await readCollection<LogEntry>("logs");
      const rows = filterLogs(logs, new URLSearchParams(rawQuery ?? ""));
      const params = new URLSearchParams(rawQuery ?? "");
      const limit = num(params.get("limit")) ?? 100;
      const offset = num(params.get("offset")) ?? 0;
      return { data: rows.slice(offset, offset + limit) as T, total: rows.length };
    }
    const data = await this.request<T>("GET", path);
    return { data, total: Array.isArray(data) ? data.length : 1 };
  },
};
