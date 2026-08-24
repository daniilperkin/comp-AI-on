import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { QueryError } from "@/components/QueryError";
import { useCreateModel, useDeleteModel, useModels, useUpdateModel } from "@/lib/queries";
import type { Model, ModelKind } from "@/types";

export default function Models() {
  const {
    data: modelsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useModels();
  const createModel = useCreateModel();
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<Model>>({});
  const [creating, setCreating] = useState(false);

  const models = modelsData ?? [];

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

  async function remove(id: number) {
    if (!confirm("Delete this model?")) return;
    await deleteModel.mutateAsync(id);
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
          <p className="text-sm text-muted-foreground">Manage the models you track.</p>
        </div>
        <Button onClick={startCreate} className="gap-1">
          <Plus className="h-4 w-4" />
          Add model
        </Button>
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>New model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ModelFields draft={draft} setDraft={setDraft} />
            <div className="flex gap-2">
              <Button onClick={save} className="gap-1">
                <Check className="h-4 w-4" /> Save
              </Button>
              <Button variant="outline" onClick={cancel} className="gap-1">
                <X className="h-4 w-4" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isError ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading models…</p>
      ) : (
        <div className="space-y-3">
          {models.map((m) =>
            editing === m.id ? (
              <Card key={m.id}>
                <CardContent className="space-y-4 pt-4">
                  <ModelFields draft={draft} setDraft={setDraft} />
                  <div className="flex gap-2">
                    <Button onClick={save} className="gap-1">
                      <Check className="h-4 w-4" /> Save
                    </Button>
                    <Button variant="outline" onClick={cancel} className="gap-1">
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card key={m.id}>
                <CardContent className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.vendor ? `${m.vendor} · ` : ""}
                        {m.kind}
                      </p>
                    </div>
                    {!m.is_active && <Badge variant="outline">inactive</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

function ModelFields({
  draft,
  setDraft,
}: {
  draft: Partial<Model>;
  setDraft: (d: Partial<Model>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input
          value={draft.name ?? ""}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="e.g. Claude 3.5 Sonnet"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Kind</Label>
        <Select
          value={draft.kind ?? "web"}
          onChange={(e) => setDraft({ ...draft, kind: e.target.value as ModelKind })}
        >
          <option value="local">local</option>
          <option value="web">web</option>
          <option value="agentic">agentic</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Vendor</Label>
        <Input
          value={draft.vendor ?? ""}
          onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
          placeholder="e.g. Anthropic"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Input price ($/MTok)</Label>
        <Input
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
        <Label>Output price ($/MTok)</Label>
        <Input
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
