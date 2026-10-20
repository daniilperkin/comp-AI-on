import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Trophy, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { QueryError } from "@/components/QueryError";
import { useCategories, useModels, useRecommend } from "@/lib/queries";

export default function Recommender() {
  const { data: categories } = useCategories();
  const { data: models } = useModels();
  const [categoryId, setCategoryId] = useState<string>("");

  const catId = categoryId ? Number(categoryId) : undefined;
  const {
    data: result,
    isLoading,
    isError,
    error,
    refetch,
  } = useRecommend(catId);

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
            <Select
              aria-label="Task category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">All categories (global ranking)</option>
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
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : result && result.recommendations.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="animate-fade-in lg:col-span-2">
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
                          ? "bg-primary/25 text-primary"
                          : "bg-primary/10 text-primary/80"
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
                        {r.success_rate != null ? `${Math.round(r.success_rate * 100)}% solved` : "no outcomes yet"}
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

          <Card className="animate-fade-in lg:self-start">
            <CardHeader>
              <CardTitle>How the ranking works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                Score = Bayesian-shrunk average quality (prior strength K=5, global
                average = {result.global_avg_quality}).
              </p>
              <p>
                Models with fewer entries are shrunk toward the global average, so a
                single lucky session cannot top the list.
              </p>
              <p>
                Only scored entries count. Score imported sessions in{" "}
                <Link to="/rate" className="underline hover:text-foreground">
                  Rate
                </Link>{" "}
                to sharpen these numbers.
              </p>
            </CardContent>
          </Card>
        </div>
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
