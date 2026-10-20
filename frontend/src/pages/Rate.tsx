import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useModelsCategories } from "@/lib/queries";
import { cn, formatCost, formatDate } from "@/lib/utils";
import type { LogEntry } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const BATCH = 50;
const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function tokenSummary(entry: LogEntry): string | null {
  const parts: string[] = [];
  if (entry.input_tokens) parts.push(`${entry.input_tokens.toLocaleString()} in`);
  if (entry.output_tokens) parts.push(`${entry.output_tokens.toLocaleString()} out`);
  if (entry.cache_read_tokens) parts.push(`${entry.cache_read_tokens.toLocaleString()} cache-read`);
  if (entry.cache_write_tokens) parts.push(`${entry.cache_write_tokens.toLocaleString()} cache-write`);
  return parts.length ? parts.join(" · ") : null;
}

export default function Rate() {
  const qc = useQueryClient();
  const { models } = useModelsCategories();
  const [index, setIndex] = useState(0);
  const [ratedCount, setRatedCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["logs", "rate", BATCH],
    queryFn: () => api.get<LogEntry[]>(`/logs?unrated=true&limit=${BATCH}`),
    staleTime: 0,
  });

  const queue = useMemo(() => query.data ?? [], [query.data]);
  const current = queue[index] ?? null;
  const modelName = useMemo(() => {
    if (!current) return "";
    return (
      current.model_name_text ||
      models.find((m) => m.id === current.model_id)?.name ||
      "Unknown model"
    );
  }, [current, models]);

  async function rate(score: number) {
    if (!current || busy) return;
    setBusy(true);
    try {
      await api.patch(`/logs/${current.id}`, { quality_score: score });
      setRatedCount((c) => c + 1);
      setIndex((i) => i + 1);
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["logs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save score");
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    if (!current) return;
    setIndex((i) => i + 1);
  }

  function loadNextBatch() {
    setIndex(0);
    setRatedCount(0);
    void query.refetch();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        void rate(Number(e.key));
      } else if (e.key === "0") {
        e.preventDefault();
        void rate(10);
      } else if (e.key.toLowerCase() === "s") {
        skip();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const exhausted = !query.isLoading && index >= queue.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rate entries</h1>
          <p className="text-sm text-muted-foreground">
            Score what the fleet actually ran — press 1–9, 0 for 10, S to skip.
          </p>
        </div>
        <Badge variant="secondary">
          {ratedCount} rated · {Math.max(0, queue.length - index)} in this batch
        </Badge>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : query.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Could not load unrated entries — is the backend running?
          </CardContent>
        </Card>
      ) : exhausted ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {ratedCount > 0 ? `Batch done — ${ratedCount} rated` : "Nothing left to rate"}
            </CardTitle>
            <CardDescription>
              {ratedCount > 0
                ? "Load the next batch of unrated entries, or review everything in History."
                : "Every entry has a quality score. Nice."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={loadNextBatch}>Load next batch</Button>
            <Link
              to="/history"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Open History
            </Link>
          </CardContent>
        </Card>
      ) : current ? (
        <Card>
          <CardHeader className="gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{modelName}</CardTitle>
              {current.origin && <Badge variant="outline">{current.origin}</Badge>}
              {current.cost_usd != null && (
                <Badge variant="secondary">{formatCost(current.cost_usd)}</Badge>
              )}
            </div>
            <CardDescription>
              {current.session_title && (
                <span className="mb-1 block truncate font-medium text-foreground/90">
                  {current.session_title}
                </span>
              )}
              {formatDate(current.created_at)}
              {current.task_description ? ` · ${current.task_description}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tokenSummary(current) && (
              <p className="text-xs text-muted-foreground">{tokenSummary(current)}</p>
            )}
            {current.notes && (
              <p className="whitespace-pre-line text-xs text-muted-foreground/80">
                {current.notes}
              </p>
            )}
            <div className="grid grid-cols-5 gap-2">
              {SCORES.map((score) => (
                <Button
                  key={score}
                  variant="outline"
                  disabled={busy}
                  onClick={() => void rate(score)}
                  aria-label={`Rate ${score} of 10`}
                >
                  {score}
                </Button>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" disabled={busy} onClick={skip}>
                Skip (S)
              </Button>
              <span className="text-xs text-muted-foreground">
                {index + 1} / {queue.length}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
