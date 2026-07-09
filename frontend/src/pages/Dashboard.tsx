import { useEffect, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { QuickAddBar, useModelsCategories } from "@/components/QuickAddBar";
import { LogTable } from "@/components/LogTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { OverviewStats, LogEntry } from "@/types";

export default function Dashboard() {
  const { models, categories } = useModelsCategories();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [recent, setRecent] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        api.get<OverviewStats>("/stats/overview"),
        api.get<LogEntry[]>("/logs?limit=10"),
      ]);
      setStats(s);
      setRecent(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Track which AI models excel at what.</p>
      </div>

      <QuickAddBar models={models} categories={categories} onCreated={load} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total entries"
          value={stats?.total_entries ?? null}
          hint={`${stats?.last_7_days ?? 0} in last 7 days`}
        />
        <StatCard
          label="Avg quality"
          value={stats?.avg_quality !== null && stats?.avg_quality !== undefined ? `${stats.avg_quality}/10` : null}
        />
        <StatCard
          label="Success rate"
          value={stats?.success_rate !== null && stats?.success_rate !== undefined ? `${Math.round(stats.success_rate * 100)}%` : null}
        />
        <StatCard label="Active models" value={models.filter((m) => m.is_active).length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent entries</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => (window.location.href = "/history")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            <LogTable
              entries={recent}
              models={models}
              categories={categories}
              emptyHint="No entries yet — add your first log using the bar above."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top models by quality</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : stats?.top_models.length ? (
              <ul className="space-y-3">
                {stats.top_models.map((t) => (
                  <li key={t.model.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t.model.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.entries} {t.entries === 1 ? "entry" : "entries"}
                      </p>
                    </div>
                    <span className="font-mono text-lg font-bold text-primary">
                      {t.avg_quality}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No scored entries yet — add quality scores to see rankings.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
