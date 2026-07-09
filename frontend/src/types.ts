export type ModelKind = "local" | "web" | "agentic";
export type Outcome = "solved" | "partial" | "failed";

export interface Model {
  id: number;
  name: string;
  kind: ModelKind;
  vendor: string | null;
  is_active: boolean;
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
  quality_score: number | null;
  outcome: Outcome | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  notes: string | null;
}

export interface LogEntryInput {
  model_id?: number | null;
  model_name_text?: string | null;
  category_id?: number | null;
  category_name_text?: string | null;
  task_description?: string | null;
  quality_score?: number | null;
  outcome?: Outcome | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cost_usd?: number | null;
  latency_ms?: number | null;
  notes?: string | null;
}

export interface OverviewStats {
  total_entries: number;
  avg_quality: number | null;
  success_rate: number | null;
  last_7_days: number;
  top_models: Array<{
    model: Model;
    avg_quality: number;
    entries: number;
  }>;
}
