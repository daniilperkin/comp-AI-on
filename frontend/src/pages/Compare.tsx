import { Fragment, useState } from "react";
import { GitCompare, Search } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompare, useModels } from "@/lib/queries";

export default function Compare() {
  const { data: models } = useModels();
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const modelIdsParam = selected.join(",");
  const { data: result, isLoading, error } = useCompare(modelIdsParam);

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // Selected models stay pinned on top so a long list never hides the current
  // pick, and typing filters on the model name. Plain computation on purpose:
  // the list is ~50 items and the React Compiler memoizes this itself.
  const term = search.trim().toLowerCase();
  const allModels = models ?? [];
  const visibleModels = [...(term ? allModels.filter((m) => m.name.toLowerCase().includes(term)) : allModels)].sort(
    (a, b) => {
      const aSel = selected.includes(a.id) ? 0 : 1;
      const bSel = selected.includes(b.id) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return a.name.localeCompare(b.name);
    }
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compare models</h1>
        <p className="text-sm text-muted-foreground">
          Select 2 or more models for a side-by-side breakdown.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            Select models ({selected.length} selected)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter models…"
                aria-label="Filter models"
                className="h-8 pl-8 text-sm"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {visibleModels.length} of {models?.length ?? 0}
            </span>
            {selected.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear selection
              </Button>
            )}
          </div>
          <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
            {visibleModels.map((m) => {
              const isSelected = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-pressed={isSelected}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
            {visibleModels.length === 0 && (
              <p className="text-sm text-muted-foreground">No models match “{search}”.</p>
            )}
          </div>
          {selected.length >= 2 && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected([])}
              >
                Clear selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selected.length < 2 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitCompare className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Select at least 2 models to compare.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading comparison…</p>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error instanceof Error
              ? error.message
              : "Failed to load comparison"}
          </CardContent>
        </Card>
      ) : result ? (
        <>
          <Group orientation="horizontal" className="flex gap-3">
            {result.models.map((stat, index) => (
              <Fragment key={stat.model.id}>
                {index > 0 && (
                  <Separator className="w-2 rounded-full bg-border transition-colors hover:bg-primary/50" />
                )}
                <Panel minSize={15} className="min-w-0">
                  <Card className="h-full animate-fade-in">
                    <CardContent className="p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {stat.model.name}
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-2xl font-bold text-foreground">
                          {stat.avg_quality != null
                            ? `${stat.avg_quality}/10`
                            : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stat.entries} entries ·{" "}
                          {stat.success_rate != null
                            ? `${Math.round(stat.success_rate * 100)}% solved`
                            : "no outcomes yet"}
                        </p>
                        {stat.avg_latency_ms != null && (
                          <p className="text-xs text-muted-foreground">
                            {stat.avg_latency_ms}ms avg
                          </p>
                        )}
                        {stat.total_cost_usd != null &&
                          stat.total_cost_usd > 0 && (
                            <p className="text-xs text-muted-foreground">
                              ${stat.total_cost_usd.toFixed(2)} total
                            </p>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                </Panel>
              </Fragment>
            ))}
          </Group>

          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Per-category breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-muted-foreground">
                        Category
                      </th>
                      {result.models.map((s) => (
                        <th
                          key={s.model.id}
                          className="px-3 py-2 text-center text-muted-foreground"
                        >
                          {s.model.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getUniqueCategories(result.models).map((cat) => (
                      <tr
                        key={`${cat.categoryId}-${cat.name}`}
                        className="border-b border-border/50"
                      >
                        <td className="px-3 py-2 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {cat.color && (
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: cat.color }}
                              />
                            )}
                            {cat.name}
                          </span>
                        </td>
                        {result.models.map((s) => {
                          const cell = s.per_category.find(
                            (c) => c.category_id === cat.categoryId,
                          );
                          return (
                            <td
                              key={s.model.id}
                              className="px-3 py-2 text-center"
                            >
                              {cell && cell.avg_quality != null ? (
                                <span className="font-mono font-medium">
                                  {cell.avg_quality}
                                  <span className="text-xs text-muted-foreground">
                                    {" "}
                                    /10 ({cell.entries})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground/30">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

interface UniqueCat {
  categoryId: number;
  name: string;
  color: string | null;
}

function getUniqueCategories(
  models: {
    per_category: {
      category_id: number;
      category_name: string;
      category_color: string | null;
    }[];
  }[],
): UniqueCat[] {
  const seen = new Map<number, UniqueCat>();
  for (const m of models) {
    for (const c of m.per_category) {
      if (!seen.has(c.category_id)) {
        seen.set(c.category_id, {
          categoryId: c.category_id,
          name: c.category_name,
          color: c.category_color,
        });
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}
