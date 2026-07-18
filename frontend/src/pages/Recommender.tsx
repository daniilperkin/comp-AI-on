import { useState } from "react";
import { Sparkles, Trophy, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCategories, useModels, useRecommend } from "@/lib/queries";

export default function Recommender() {
  const { data: categories } = useCategories();
  const { data: models } = useModels();
  const [categoryId, setCategoryId] = useState<string>("");

  const catId = categoryId ? Number(categoryId) : undefined;
  const { data: result, isLoading } = useRecommend(catId);

  const activeModels = models ?? [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recommender</h1>
        <p className="text-sm text-muted-foreground">
          Find the best tool for the job. Bayesian-shrunk by sample size.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Pick a task category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories (global)</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Loading recommendations…</p>
      ) : result && result.recommendations.length > 0 ? (
        <>
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Top picks {result.category_name ? `for ${result.category_name}` : "(global)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.recommendations.map((r, i) => (
                <div
                  key={r.model.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
                        i === 0
                          ? "bg-amber-500/15 text-amber-500"
                          : i === 1
                          ? "bg-slate-400/15 text-slate-400"
                          : i === 2
                          ? "bg-orange-700/15 text-orange-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{r.model.name}</p>
                        <Badge variant="outline">{r.model.kind}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {r.entries} {r.entries === 1 ? "entry" : "entries"} ·{" "}
                        {r.success_rate != null ? `${Math.round(r.success_rate * 100)}% solved` : "no solved data"}
                        {r.model.vendor ? ` · ${r.model.vendor}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-2xl font-bold text-primary">{r.score}</p>
                    <p className="text-xs text-muted-foreground">
                      avg {r.avg_quality}/10
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Score = Bayesian-shrunk average quality (prior strength K=5, global avg = {result.global_avg_quality}).
            Models with fewer entries are shrunk toward the global average to avoid overfitting to small samples.
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Not enough scored entries yet. Add quality scores to your log entries to get recommendations.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              {activeModels.length} active models tracked.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
