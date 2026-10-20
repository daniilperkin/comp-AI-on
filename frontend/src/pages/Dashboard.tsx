import { StatCard } from "@/components/StatCard";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { QuickAddBar } from "@/components/QuickAddBar";
import { LogTable } from "@/components/LogTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogTableSkeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { cn, formatCost } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useModels, useStatsOverview, useLogs } from "@/lib/queries";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStatsOverview();
  const { data: recent, isLoading: recentLoading } = useLogs({ limit: 10 });
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

      <div data-motion="stagger" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {statsLoading ? (
          <StatCardSkeleton count={5} />
        ) : (
          <>
            <div className="animate-fade-in" style={{ animationDelay: "0ms" }}>
              <StatCard
                label="Total entries"
                value={<AnimatedNumber value={stats?.total_entries ?? 0} />}
                hint={`${stats?.last_7_days ?? 0} in last 7 days`}
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "80ms" }}>
              <StatCard
                label="Avg quality"
                value={
                  stats?.avg_quality !== null && stats?.avg_quality !== undefined ? (
                    <AnimatedNumber
                      value={stats.avg_quality}
                      format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                    />
                  ) : (
                    "—"
                  )
                }
                hint="out of 10"
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "160ms" }}>
              <StatCard
                label="Success rate"
                value={
                  stats?.success_rate !== null && stats?.success_rate !== undefined ? (
                    <AnimatedNumber
                      value={stats.success_rate}
                      format={{ style: "percent", maximumFractionDigits: 0 }}
                    />
                  ) : (
                    "—"
                  )
                }
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
              <StatCard
                label="Spend (30d)"
                value={formatCost(stats?.total_cost_30d ?? null)}
                hint={
                  stats?.total_cost_all_time
                    ? `all time ${formatCost(stats.total_cost_all_time)}`
                    : undefined
                }
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "240ms" }}>
              <StatCard
                label="Active models"
                value={<AnimatedNumber value={activeModels.filter((m) => m.is_active).length} />}
              />
            </div>
          </>
        )}
      </div>

      <ActivityHeatmap />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card data-motion="rise" className="animate-fade-in lg:col-span-2" style={{ animationDelay: "320ms" }}>
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
            {recentLoading ? (
              <LogTableSkeleton rows={5} />
            ) : (
              <LogTable
                entries={recentEntries}
                emptyHint="No entries yet — add your first log using the bar above."
              />
            )}
          </CardContent>
        </Card>

        <Card data-motion="rise" className="animate-fade-in" style={{ animationDelay: "400ms" }}>
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
