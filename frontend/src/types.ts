export type ModelKind = "local" | "web" | "agentic";
export type Outcome = "solved" | "partial" | "failed";

export interface Model {
  id: number;
  name: string;
  kind: ModelKind;
  vendor: string | null;
  is_active: boolean;
  input_price_per_mtok: number | null;
  output_price_per_mtok: number | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string | null;
  created_at: string;
}

export interface LogEntry {
  id: number;
  created_at: string;
  model_id: number | null;
  model_name_text: string | null;
  category_id: number | null;
  category_name_text: string | null;
  task_description: string | null;
  session_title: string | null;
  quality_score: number | null;
  outcome: Outcome | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  reasoning_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  notes: string | null;
  origin: string | null;
}

export interface LogEntryInput {
  model_id?: number | null;
  model_name_text?: string | null;
  category_id?: number | null;
  category_name_text?: string | null;
  task_description?: string | null;
  session_title?: string | null;
  quality_score?: number | null;
  outcome?: Outcome | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_tokens?: number | null;
  cache_write_tokens?: number | null;
  reasoning_tokens?: number | null;
  cost_usd?: number | null;
  latency_ms?: number | null;
  notes?: string | null;
}

export interface OverviewStats {
  total_entries: number;
  avg_quality: number | null;
  success_rate: number | null;
  last_7_days: number;
  total_cost_30d: number;
  total_cost_all_time: number;
  top_models: Array<{
    model: Model;
    avg_quality: number;
    entries: number;
  }>;
}

export interface TimelinePoint {
  date: string;
  count: number;
  avg_quality: number | null;
}

export interface LeaderboardEntry {
  model: Model;
  avg_quality: number | null;
  entries: number;
  success_rate: number | null;
  total_cost: number;
}

export interface SpendByModel {
  model_id: number | null;
  model_name: string;
  total_cost: number;
  entries: number;
}

export interface SpendData {
  daily: Array<{ date: string; cost: number }>;
  by_model: SpendByModel[];
}

export interface MatrixCell {
  model_id: number;
  model_name: string;
  category_id: number;
  category_name: string;
  category_color: string | null;
  avg_quality: number;
  entries: number;
}

export interface MatrixData {
  models: Model[];
  categories: Category[];
  cells: MatrixCell[];
}

export interface AppNotification {
  id: number;
  created_at: string;
  title: string;
  body: string;
  channel: string;
  shown: boolean;
}

export interface RecommendationEntry {
  model: Model;
  avg_quality: number;
  entries: number;
  success_rate: number;
  score: number;
}

export interface RecommendationResult {
  category_id: number | null;
  category_name: string | null;
  recommendations: RecommendationEntry[];
  global_avg_quality: number;
}

export interface CompareCategoryStat {
  category_id: number;
  category_name: string;
  category_color: string | null;
  avg_quality: number | null;
  entries: number;
}

export interface CompareModelStat {
  model: Model;
  avg_quality: number | null;
  entries: number;
  success_rate: number | null;
  avg_latency_ms: number | null;
  total_cost_usd: number | null;
  per_category: CompareCategoryStat[];
}

export interface CompareResult {
  models: CompareModelStat[];
}
