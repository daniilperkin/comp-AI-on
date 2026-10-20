import type { Category, LogEntry, Model, Outcome } from "@/types";

export interface DemoDb {
  models: Model[];
  categories: Category[];
  logs: LogEntry[];
  settings: Record<string, string>;
  seq: { logs: number; models: number; categories: number };
}

/** Deterministic PRNG so every build ships the same demo dataset. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;

const MODEL_SPECS: Array<Omit<Model, "id" | "created_at">> = [
  { name: "Claude Opus 4.6", kind: "agentic", vendor: "Anthropic", is_active: true, input_price_per_mtok: 5, output_price_per_mtok: 20 },
  { name: "GPT-5.1 Codex", kind: "agentic", vendor: "OpenAI", is_active: true, input_price_per_mtok: 1.25, output_price_per_mtok: 10 },
  { name: "Gemini 3.1 Pro", kind: "web", vendor: "Google", is_active: true, input_price_per_mtok: 1.25, output_price_per_mtok: 10 },
  { name: "deepseek/deepseek-v4.1-flash-1017", kind: "web", vendor: "deepinfra", is_active: true, input_price_per_mtok: 0.14, output_price_per_mtok: 0.42 },
  { name: "glm-5.3-flash", kind: "web", vendor: "GMICloud", is_active: true, input_price_per_mtok: 0.09, output_price_per_mtok: 0.3 },
  { name: "Cursor", kind: "agentic", vendor: "Anysphere", is_active: true, input_price_per_mtok: null, output_price_per_mtok: null },
  { name: "Llama 3.3 70B (local)", kind: "local", vendor: "Meta", is_active: true, input_price_per_mtok: 0, output_price_per_mtok: 0 },
  { name: "Qwen3-Coder 30B (local)", kind: "local", vendor: "Alibaba", is_active: true, input_price_per_mtok: 0, output_price_per_mtok: 0 },
];

const CATEGORY_SPECS: Array<{ name: string; color: string }> = [
  { name: "Coding", color: "#3b82f6" },
  { name: "Debugging", color: "#ef4444" },
  { name: "Refactoring", color: "#8b5cf6" },
  { name: "Writing", color: "#10b981" },
  { name: "Design", color: "#f59e0b" },
  { name: "Research", color: "#06b6d4" },
  { name: "Architecture", color: "#ec4899" },
];

const TASKS = [
  "Fix flaky integration test",
  "Refactor router module",
  "Draft release notes",
  "Design dashboard layout",
  "Investigate memory spike",
  "Write migration for new column",
  "Explain WebSocket reconnect logic",
  "Review PR #128",
  "Optimize slow SQL query",
  "Sketch onboarding flow",
  "Compare two chart libraries",
  "Add keyboard shortcuts",
];

const HERMES_TASKS = ["", "", "", "title_generation", "compression", "approval"];

function iso(daysAgo: number, minuteJitter: number): string {
  return new Date(Date.now() - daysAgo * DAY - minuteJitter * 60_000)
    .toISOString()
    .replace("Z", "");
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function buildDemoDb(): DemoDb {
  const rand = mulberry32(20261020);
  const models: Model[] = MODEL_SPECS.map((spec, i) => ({
    ...spec,
    id: i + 1,
    created_at: iso(180, i),
  }));
  const categories: Category[] = CATEGORY_SPECS.map((spec, i) => ({
    ...spec,
    id: i + 1,
    created_at: iso(180, i),
  }));

  const logs: LogEntry[] = [];
  let id = 1;
  for (let d = 44; d >= 0; d--) {
    const entriesToday = 1 + Math.floor(rand() * 5);
    for (let i = 0; i < entriesToday; i++) {
      const model = pick(rand, models);
      const category = pick(rand, categories);
      const rated = rand() > 0.3;
      const quality = rated ? 3 + Math.floor(rand() * 8) : null;
      const outcomeRoll = rand();
      const outcome: Outcome | null = !rated
        ? null
        : quality! >= 8
          ? outcomeRoll > 0.2
            ? "solved"
            : "partial"
          : quality! >= 6
            ? outcomeRoll > 0.5
              ? "solved"
              : outcomeRoll > 0.2
                ? "partial"
                : "failed"
            : outcomeRoll > 0.7
              ? "partial"
              : "failed";

      const hermes = rand() > 0.3;
      const inputTokens = 800 + Math.floor(rand() * 42_000);
      const outputTokens = 200 + Math.floor(rand() * 6_000);
      const cacheRead = model.kind === "agentic" ? Math.floor(rand() * 1_500_000) : Math.floor(rand() * 20_000);
      const cacheWrite = model.kind === "agentic" ? Math.floor(rand() * 120_000) : 0;
      const priceIn = model.input_price_per_mtok ?? 0;
      const priceOut = model.output_price_per_mtok ?? 0;
      const cost = Number(
        (
          (inputTokens / 1e6) * priceIn +
          (outputTokens / 1e6) * priceOut +
          (cacheRead / 1e6) * priceIn * 0.1 +
          (cacheWrite / 1e6) * priceIn
        ).toFixed(6),
      );

      const task = hermes ? pick(rand, HERMES_TASKS) : pick(rand, TASKS);
      logs.push({
        id: id++,
        created_at: iso(d, Math.floor(rand() * 900)),
        model_id: model.id,
        model_name_text: model.name,
        category_id: hermes && rand() > 0.55 ? null : category.id,
        category_name_text: null,
        task_description: hermes
          ? task
            ? `auto-imported (hermes:${task})`
            : "auto-imported (hermes)"
          : task,
        quality_score: quality,
        outcome,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_tokens: cacheRead,
        cache_write_tokens: cacheWrite,
        reasoning_tokens: Math.floor(rand() * 2_000),
        cost_usd: cost,
        latency_ms: 300 + Math.floor(rand() * 9_000),
        notes: hermes
          ? `Hermes profile: ${pick(rand, ["default", "companion", "sprintstart", "openshorts"])} · source: ${pick(rand, ["desktop", "tui", "cron", "telegram"])}\ncost: estimated ($${cost.toFixed(4)})`
          : null,
        origin: hermes ? "hermes" : "manual",
      });
    }
  }

  logs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return {
    models,
    categories,
    logs,
    settings: {
      reminder_enabled: "true",
      reminder_time: "18:00",
      channel_os_toast: "false",
      channel_browser_overlay: "true",
      seed_version: "3",
      hermes_sync_enabled: "true",
      last_hermes_sync_at: iso(0, 42),
    },
    seq: { logs: id, models: models.length + 1, categories: categories.length + 1 },
  };
}
