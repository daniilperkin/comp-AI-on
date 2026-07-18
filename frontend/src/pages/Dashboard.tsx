import { StatCard } from "@/components/StatCard";
import { QuickAddBar } from "@/components/QuickAddBar";
import { LogTable } from "@/components/LogTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useModels, useStatsOverview, useLogs } from "@/lib/queries";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStatsOverview();
  const { data: recent } = useLogs({ limit: 10 });
  const { data: models } = useModels();

  const recentEntries = recent ?? [];
  const activeModels = models ?? [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Track which AI models excel at what.</p>
      </div>

      <QuickAddBar />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-fade-in" style={{ animationDelay: "0ms" }}>
          <StatCard
            label="Total entries"
            value={stats?.total_entries ?? null}
            hint={`${stats?.last_7_days ?? 0} in last 7 days`}
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: "80ms" }}>
          <StatCard
            label="Avg quality"
            value={stats?.avg_quality !== null && stats?.avg_quality !== undefined ? `${stats.avg_quality}/10` : null}
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: "160ms" }}>
          <StatCard
            label="Success rate"
            value={stats?.success_rate !== null && stats?.success_rate !== undefined ? `${Math.round(stats.success_rate * 100)}%` : null}
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: "240ms" }}>
          <StatCard label="Active models" value={activeModels.filter((m) => m.is_active).length} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="animate-fade-in lg:col-span-2" style={{ animationDelay: "320ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent entries</CardTitle>
            <Link
              to="/history"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <LogTable
              entries={recentEntries}
              emptyHint="No entries yet — add your first log using the bar above."
            />
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: "400ms" }}>
          <CardHeader>
            <CardTitle>Top models by quality</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
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
