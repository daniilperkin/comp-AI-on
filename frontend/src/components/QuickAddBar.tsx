import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useCreateLog, useDeleteLog, useModelsCategories } from "@/lib/queries";
import type { LogEntryInput, Outcome } from "@/types";

interface QuickAddBarProps {
  onCreated?: () => void;
  /** Pre-select a model — used when the palette launches capture for one. */
  initialModelId?: number;
}

export function QuickAddBar({ onCreated, initialModelId }: QuickAddBarProps) {
  const navigate = useNavigate();
  const { models, categories } = useModelsCategories();
  const createLog = useCreateLog();
  const deleteLog = useDeleteLog();
  const [expanded, setExpanded] = useState(false);
  const [modelId, setModelId] = useState(initialModelId ? String(initialModelId) : "");
  const [categoryId, setCategoryId] = useState("");
  const [score, setScore] = useState("");
  const [outcome, setOutcome] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const descriptionRef = useRef<HTMLInputElement>(null);

  const activeModels = models.filter((m) => m.is_active);
  const saving = createLog.isPending;

  function reset() {
    setModelId("");
    setCategoryId("");
    setScore("");
    setOutcome("");
    setDescription("");
    setError("");
    setExpanded(false);
  }

  async function handleSave() {
    setError("");
    const hasContent = modelId || categoryId || description.trim();
    if (!hasContent) {
      // The collapsed bar cannot satisfy this error, so open the row that can
      // and put the cursor in it instead of printing a hint the user can't act on.
      setExpanded(true);
      setError("Pick a model or category, or add a description.");
      requestAnimationFrame(() => descriptionRef.current?.focus());
      return;
    }
    const payload: LogEntryInput = {};
    if (modelId) payload.model_id = Number(modelId);
    if (categoryId) payload.category_id = Number(categoryId);
    if (description.trim()) payload.task_description = description.trim();
    if (score) payload.quality_score = Number(score);
    if (outcome) payload.outcome = outcome as Outcome;

    try {
      const entry = await createLog.mutateAsync(payload);
      // The confirmation lives here rather than in the capture dialog so both
      // entry points — the dashboard bar and the Alt+L dialog — get the same
      // toast, and the same one-click undo. The row already exists on the
      // server by now, so undo is a DELETE of the entry we just created.
      const modelLabel =
        entry.model_name_text?.trim() ||
        models.find((m) => m.id === entry.model_id)?.name ||
        "session";
      toast.success(`Logged ${modelLabel}`, {
        // Live testing made the case for a longer window than the 4s default:
        // this toast's whole purpose is the one-click correction, and four
        // seconds is not enough time to notice it, read it and reach the
        // button. Eight seconds keeps the safety net usable.
        duration: 8000,
        description:
          entry.quality_score !== null && entry.quality_score !== undefined
            ? `score ${entry.quality_score}/10`
            : undefined,
        action: {
          label: "Undo",
          onClick: () => {
            void deleteLog.mutateAsync(entry.id).catch(() => {
              toast.error("Could not undo that entry.");
            });
          },
        },
      });
      onCreated?.();
      setModelId("");
      setCategoryId("");
      setScore("");
      setOutcome("");
      setDescription("");
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  return (
    <form
      className="rounded-lg border border-border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") reset();
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label htmlFor="quick-model" className="mb-1 block text-xs text-muted-foreground">
            Model
          </label>
          <Select id="quick-model" value={modelId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">— none —</option>
            {activeModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[140px] flex-1">
          <label htmlFor="quick-category" className="mb-1 block text-xs text-muted-foreground">
            Category
          </label>
          <Select
            id="quick-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-[80px]">
          <label htmlFor="quick-score" className="mb-1 block text-xs text-muted-foreground">
            Score (1-10)
          </label>
          <Input
            id="quick-score"
            type="number"
            min={1}
            max={10}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="—"
          />
        </div>

        <Button type="submit" disabled={saving} className="gap-1">
          <Plus className="h-4 w-4" />
          {saving ? "Saving..." : "Log it"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Hide extra options" : "More options"}
          aria-expanded={expanded}
          title={expanded ? "Less" : "More options"}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="min-w-[140px] flex-1">
            <label htmlFor="quick-outcome" className="mb-1 block text-xs text-muted-foreground">
              Outcome
            </label>
            <Select
              id="quick-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="">— none —</option>
              <option value="solved">Solved</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
            </Select>
          </div>
          <div className="min-w-[200px] flex-[2]">
            <label
              htmlFor="quick-description"
              className="mb-1 block text-xs text-muted-foreground"
            >
              Task description
            </label>
            <Input
              id="quick-description"
              ref={descriptionRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you ask it to do?"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate("/log")}>
            Full form
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </form>
  );
}
