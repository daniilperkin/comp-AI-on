import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Check, X, Search } from "lucide-react";
import { QueryError } from "@/components/QueryError";
import {
  useCreateModel,
  useDeleteModel,
  useModels,
  useStatsLeaderboard,
  useUpdateModel,
} from "@/lib/queries";
import type { Model, ModelKind } from "@/types";

export default function Models() {
  const {
    data: modelsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useModels();
  const { data: leaderboard } = useStatsLeaderboard();
  const createModel = useCreateModel();
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<Model>>({});
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Model | null>(null);
  const [search, setSearch] = useState("");

  const models = modelsData ?? [];

  // Entries and average score live on the leaderboard endpoint; joining by id
  // keeps this page to two requests instead of one per model.
  const statsById = new Map(
    (leaderboard ?? [])
      .filter((row) => row.model)
      .map((row) => [
        row.model.id,
        { entries: row.entries, avgQuality: row.avg_quality },
      ])
  );

  const term = search.trim().toLowerCase();
  const visibleModels = (term
    ? models.filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          (m.vendor ?? "").toLowerCase().includes(term)
      )
    : models
  )
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  async function save() {
    if (!draft.name?.trim()) return;
    const payload = {
      name: draft.name,
      kind: (draft.kind ?? "web") as ModelKind,
      vendor: draft.vendor ?? "",
      is_active: draft.is_active ?? true,
      input_price_per_mtok: draft.input_price_per_mtok ?? null,
      output_price_per_mtok: draft.output_price_per_mtok ?? null,
    };
    if (editing) {
      await updateModel.mutateAsync({ id: editing, input: payload });
    } else {
      await createModel.mutateAsync(payload);
    }
    cancel();
  }

  async function confirmDelete() {
    const model = pendingDelete;
    if (!model) return;
    setPendingDelete(null);
    await deleteModel.mutateAsync(model.id);
    // The row is gone on the server, so undo is a re-create with the same
    // fields. It returns with a new id: log entries that referenced the
    // deleted row keep their recorded name but cannot be relinked.
    toast.success(`Deleted ${model.name}`, {
      duration: 8000,
      description: "Undo re-creates the model with a new id.",
      action: {
        label: "Undo",
        onClick: () => {
          void createModel
            .mutateAsync({
              name: model.name,
              kind: model.kind,
              vendor: model.vendor ?? "",
              is_active: model.is_active,
              input_price_per_mtok: model.input_price_per_mtok ?? null,
              output_price_per_mtok: model.output_price_per_mtok ?? null,
            })
            .catch(() => toast.error("Could not restore that model."));
        },
      },
    });
  }

  function startCreate() {
    setDraft({ name: "", kind: "web", vendor: "", is_active: true });
    setCreating(true);
    setEditing(null);
  }

  function startEdit(m: Model) {
    setDraft({ ...m });
    setEditing(m.id);
    setCreating(false);
  }

  function cancel() {
    setEditing(null);
    setCreating(false);
    setDraft({});
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Models</h1>
          <p className="text-sm text-muted-foreground">
            {models.length} models · {models.filter((m) => m.is_active).length} active
          </p>
        </div>
        <Button onClick={startCreate} className="gap-1">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add model
        </Button>
      </div>

      {(creating || editing !== null) && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit model" : "New model"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ModelFields
              idPrefix={editing ? `edit-model-${editing}` : "new-model"}
              draft={draft}
              setDraft={setDraft}
            />
            <div className="flex gap-2">
              <Button onClick={save} className="gap-1">
                <Check className="h-4 w-4" aria-hidden="true" /> Save
              </Button>
              <Button variant="outline" onClick={cancel} className="gap-1">
                <X className="h-4 w-4" aria-hidden="true" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models…"
          aria-label="Search models"
          className="h-9 pl-8"
        />
      </div>

      {isError ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading models…</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2 font-medium">Name</th>
                    <th scope="col" className="px-4 py-2 font-medium">Vendor</th>
                    <th scope="col" className="px-4 py-2 font-medium">Kind</th>
                    <th scope="col" className="px-4 py-2 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Entries</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Avg score</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleModels.map((m) => {
                    const stats = statsById.get(m.id);
                    return (
                      <tr key={m.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2 font-medium">{m.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{m.vendor || "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{m.kind}</td>
                        <td className="px-4 py-2">
                          {m.is_active ? (
                            <Badge variant="outline">active</Badge>
                          ) : (
                            <Badge variant="outline">inactive</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {stats?.entries ?? 0}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {stats?.avgQuality != null ? `${stats.avgQuality}/10` : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEdit(m)}
                              aria-label={`Edit ${m.name}`}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPendingDelete(m)}
                              aria-label={`Delete ${m.name}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleModels.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        {term ? `No models match “${search}”.` : "No models yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={`Delete ${pendingDelete?.name ?? "model"}?`}
        description="Log entries that reference this model keep their recorded name but lose the link. You can undo this right after."
        confirmLabel="Delete model"
        busy={deleteModel.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function ModelFields({
  idPrefix,
  draft,
  setDraft,
}: {
  idPrefix: string;
  draft: Partial<Model>;
  setDraft: (d: Partial<Model>) => void;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor={id("name")}>Name</Label>
        <Input
          id={id("name")}
          value={draft.name ?? ""}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="e.g. Claude 3.5 Sonnet"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("kind")}>Kind</Label>
        <Select
          id={id("kind")}
          value={draft.kind ?? "web"}
          onChange={(e) => setDraft({ ...draft, kind: e.target.value as ModelKind })}
        >
          <option value="local">local</option>
          <option value="web">web</option>
          <option value="agentic">agentic</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("vendor")}>Vendor</Label>
        <Input
          id={id("vendor")}
          value={draft.vendor ?? ""}
          onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
          placeholder="e.g. Anthropic"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("input-price")}>Input price ($/MTok)</Label>
        <Input
          id={id("input-price")}
          type="number"
          step="any"
          min="0"
          value={draft.input_price_per_mtok ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              input_price_per_mtok: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          placeholder="optional — enables cost tracking"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("output-price")}>Output price ($/MTok)</Label>
        <Input
          id={id("output-price")}
          type="number"
          step="any"
          min="0"
          value={draft.output_price_per_mtok ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              output_price_per_mtok: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          placeholder="optional — enables cost tracking"
        />
      </div>
    </div>
  );
}
