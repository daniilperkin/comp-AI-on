import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { LogEntry, LogEntryInput, Model, Category, Outcome } from "@/types";

interface QuickAddBarProps {
  models: Model[];
  categories: Category[];
  onCreated?: (entry: LogEntry) => void;
}

export function QuickAddBar({ models, categories, onCreated }: QuickAddBarProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [modelId, setModelId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [score, setScore] = useState("");
  const [outcome, setOutcome] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeModels = models.filter((m) => m.is_active);

  async function handleSave() {
    setError("");
    const hasContent = modelId || categoryId || description.trim();
    if (!hasContent) {
      setError("Pick a model or category, or add a description.");
      return;
    }
    const payload: LogEntryInput = {};
    if (modelId) payload.model_id = Number(modelId);
    if (categoryId) payload.category_id = Number(categoryId);
    if (description.trim()) payload.task_description = description.trim();
    if (score) payload.quality_score = Number(score);
    if (outcome) payload.outcome = outcome as Outcome;

    setSaving(true);
    try {
      const entry = await api.post<LogEntry>("/logs", payload);
      onCreated?.(entry);
      setModelId("");
      setCategoryId("");
      setScore("");
      setOutcome("");
      setDescription("");
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">Model</label>
          <Select value={modelId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">— none —</option>
            {activeModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">Category</label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-[80px]">
          <label className="mb-1 block text-xs text-muted-foreground">Score (1-10)</label>
          <Input
            type="number"
            min={1}
            max={10}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="—"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-1">
          <Plus className="h-4 w-4" />
          {saving ? "Saving..." : "Log it"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Less" : "More options"}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Outcome</label>
            <Select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="">— none —</option>
              <option value="solved">Solved</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
            </Select>
          </div>
          <div className="min-w-[200px] flex-[2]">
            <label className="mb-1 block text-xs text-muted-foreground">Task description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you ask it to do?"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/log")}>
            Full form
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function useModelsCategories() {
  const [models, setModels] = useState<Model[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api.get<Model[]>("/models").then(setModels).catch(() => {});
    api.get<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  return { models, categories, setModels, setCategories };
}
