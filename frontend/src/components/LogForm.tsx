import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Trash2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useCreateLog, useCreateModel, useModelsCategories, useUpdateLog } from "@/lib/queries";
import type { LogEntry, LogEntryInput, ModelKind, Outcome } from "@/types";

const empty: LogEntryInput = {
  model_id: null,
  model_name_text: "",
  category_id: null,
  category_name_text: "",
  task_description: "",
  quality_score: null,
  outcome: null,
  input_tokens: null,
  output_tokens: null,
  cost_usd: null,
  latency_ms: null,
  notes: "",
};

export default function LogForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editingId = id ? Number(id) : null;
  const { models, categories } = useModelsCategories();
  const createLog = useCreateLog();
  const updateLog = useUpdateLog();
  const createModel = useCreateModel();

  const [form, setForm] = useState<LogEntryInput>({ ...empty });
  const [newModelKind, setNewModelKind] = useState<ModelKind>("web");
  const [newModelVendor, setNewModelVendor] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!editingId) {
      setForm({ ...empty });
      setLoaded(true);
      return;
    }
    let cancelled = false;
    api.get<LogEntry>(`/logs/${editingId}`)
      .then((e) => {
        if (cancelled) return;
        setForm({
          model_id: e.model_id,
          model_name_text: e.model_name_text ?? "",
          category_id: e.category_id,
          category_name_text: e.category_name_text ?? "",
          task_description: e.task_description ?? "",
          quality_score: e.quality_score,
          outcome: e.outcome,
          input_tokens: e.input_tokens,
          output_tokens: e.output_tokens,
          cost_usd: e.cost_usd,
          latency_ms: e.latency_ms,
          notes: e.notes ?? "",
        });
        setLoaded(true);
      })
      .catch(() => setError("Entry not found"));
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  const isNewModel = (() => {
    const typed = form.model_name_text?.trim().toLowerCase();
    if (!typed || form.model_id) return false;
    return !models.some((m) => m.name.toLowerCase() === typed);
  })();

  function set<K extends keyof LogEntryInput>(key: K, value: LogEntryInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setError("");
    const hasContent =
      form.model_id || form.model_name_text?.trim() || form.category_id ||
      form.category_name_text?.trim() || form.task_description?.trim();
    if (!hasContent) {
      setError("Provide at least a model, category, or task description.");
      return;
    }

    setSaving(true);
    try {
      let payload: LogEntryInput = { ...form };

      if (isNewModel) {
        const newModel = await createModel.mutateAsync({
          name: form.model_name_text!.trim(),
          kind: newModelKind,
          vendor: newModelVendor.trim() || null,
          is_active: true,
        });
        payload = { ...payload, model_id: newModel.id, model_name_text: null };
      }

      if (payload.model_id === null) delete payload.model_id;
      if (payload.category_id === null) delete payload.category_id;
      if (!payload.quality_score) delete payload.quality_score;
      if (!payload.outcome) delete payload.outcome;

      if (editingId) {
        await updateLog.mutateAsync({ id: editingId, input: payload });
      } else {
        await createLog.mutateAsync(payload);
      }
      navigate("/history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    if (!confirm("Delete this log entry?")) return;
    try {
      await api.delete(`/logs/${editingId}`);
      navigate("/history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  if (!loaded) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit log entry" : "New log entry"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Select
                value={form.model_id?.toString() ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  set("model_id", val);
                  if (val) set("model_name_text", "");
                }}
              >
                <option value="">— free text below —</option>
                {models.filter((m) => m.is_active).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
              <Input
                placeholder="Or type a model name"
                value={form.model_name_text ?? ""}
                onChange={(e) => {
                  set("model_name_text", e.target.value);
                  set("model_id", null);
                }}
              />
              {isNewModel && (
                <div className="animate-fade-in rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">
                      New model — will be added to your Models list
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Kind</Label>
                      <Select
                        value={newModelKind}
                        onChange={(e) => setNewModelKind(e.target.value as ModelKind)}
                      >
                        <option value="local">local</option>
                        <option value="web">web</option>
                        <option value="agentic">agentic</option>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Vendor</Label>
                      <Input
                        placeholder="e.g. Anthropic"
                        value={newModelVendor}
                        onChange={(e) => setNewModelVendor(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category_id?.toString() ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  set("category_id", val);
                  if (val) set("category_name_text", "");
                }}
              >
                <option value="">— free text below —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Input
                placeholder="Or type category name"
                value={form.category_name_text ?? ""}
                onChange={(e) => {
                  set("category_name_text", e.target.value);
                  set("category_id", null);
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Task description</Label>
            <Textarea
              rows={2}
              placeholder="What did you ask the model to do?"
              value={form.task_description ?? ""}
              onChange={(e) => set("task_description", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Quality score (1-10)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.quality_score ?? ""}
                onChange={(e) => set("quality_score", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Select
                value={form.outcome ?? ""}
                onChange={(e) => set("outcome", (e.target.value || null) as Outcome | null)}
              >
                <option value="">— none —</option>
                <option value="solved">Solved</option>
                <option value="partial">Partial</option>
                <option value="failed">Failed</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Latency (ms)</Label>
              <Input
                type="number"
                min={0}
                value={form.latency_ms ?? ""}
                onChange={(e) => set("latency_ms", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Input tokens</Label>
              <Input
                type="number"
                min={0}
                value={form.input_tokens ?? ""}
                onChange={(e) => set("input_tokens", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Output tokens</Label>
              <Input
                type="number"
                min={0}
                value={form.output_tokens ?? ""}
                onChange={(e) => set("output_tokens", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cost (USD)</Label>
              <Input
                type="number"
                step="0.0001"
                min={0}
                value={form.cost_usd ?? ""}
                onChange={(e) => set("cost_usd", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes / takeaways</Label>
            <Textarea
              rows={3}
              placeholder="What did you learn? What to use next time?"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="gap-1">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : editingId ? "Update entry" : "Save entry"}
            </Button>
            {editingId && (
              <Button variant="destructive" onClick={handleDelete} className="gap-1">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/history")}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
