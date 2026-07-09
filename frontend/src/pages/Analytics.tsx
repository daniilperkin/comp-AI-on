import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Trophy, Grid3x3 } from "lucide-react";
import { api } from "@/lib/api";
import type { TimelinePoint, LeaderboardEntry, MatrixData, MatrixCell } from "@/types";

const CHART_HEIGHT = 280;

function useChartTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  return {
    tooltip: {
      backgroundColor: isDark ? "hsl(0 0% 10%)" : "hsl(0 0% 100%)",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
      borderRadius: "0.625rem",
      color: isDark ? "hsl(40 33% 96%)" : "hsl(0 0% 10%)",
      fontSize: "0.75rem",
    },
    grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    axis: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
    area: isDark ? "hsl(199 89% 48%)" : "hsl(199 89% 38%)",
  };
}

export default function AnalyticsPage() {
  const chartTheme = useChartTheme();
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<TimelinePoint[]>("/stats/timeline"),
      api.get<LeaderboardEntry[]>("/stats/leaderboard"),
      api.get<MatrixData>("/stats/matrix"),
    ])
      .then(([t, l, m]) => {
        setTimeline(t);
        setLeaderboard(l);
        setMatrix(m);
      })
      .finally(() => setLoading(false));
  }, []);

  function exportData(format: "csv" | "json") {
    window.location.href = `/api/logs/export/${format}`;
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">Loading analytics…</p>
      </div>
    );
  }

  const hasData = timeline.length > 0 || leaderboard.length > 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Which models win at which tasks.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportData("csv")} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData("json")} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>
        </div>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No data yet. Add some log entries to see analytics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Timeline */}
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Daily entry timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <AreaChart data={timeline} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <defs>
                    <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartTheme.area} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={chartTheme.area} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="date"
                    stroke={chartTheme.axis}
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={chartTheme.axis}
                    fontSize={11}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={chartTheme.tooltip} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={chartTheme.area}
                    strokeWidth={2}
                    fill="url(#timelineGradient)"
                    name="Entries"
                    animationDuration={600}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Leaderboard */}
            <Card className="animate-fade-in" style={{ animationDelay: "100ms" }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Model leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboard.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, leaderboard.length * 40)}>
                    <BarChart
                      data={leaderboard}
                      layout="vertical"
                      margin={{ top: 5, right: 10, bottom: 5, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis
                        type="number"
                        domain={[0, 10]}
                        stroke={chartTheme.axis}
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="model.name"
                        stroke={chartTheme.axis}
                        fontSize={11}
                        tickLine={false}
                        width={120}
                      />
                      <Tooltip contentStyle={chartTheme.tooltip} />
                      <Bar
                        dataKey="avg_quality"
                        name="Avg quality"
                        radius={[0, 4, 4, 0]}
                        animationDuration={600}
                      >
                        {leaderboard.map((_, i) => (
                          <Cell key={i} fill={getBarColor(i)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No scored entries yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Model-vs-category matrix */}
            <Card className="animate-fade-in" style={{ animationDelay: "200ms" }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Grid3x3 className="h-4 w-4 text-primary" />
                  Model vs category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {matrix && matrix.cells.length > 0 ? (
                  <MatrixHeatmap data={matrix} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No scored entries with both model and category yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function getBarColor(index: number): string {
  const colors = [
    "hsl(199 89% 48%)",
    "hsl(160 84% 39%)",
    "hsl(280 65% 60%)",
    "hsl(35 92% 55%)",
    "hsl(0 72% 51%)",
    "hsl(190 95% 40%)",
    "hsl(330 75% 55%)",
  ];
  return colors[index % colors.length];
}

function MatrixHeatmap({ data }: { data: MatrixData }) {
  const { models, categories, cells } = data;

  const cellMap = new Map<string, MatrixCell>();
  for (const c of cells) {
    cellMap.set(`${c.model_id}-${c.category_id}`, c);
  }

  function colorForScore(score: number | null): string {
    if (score === null) return "transparent";
    const t = score / 10;
    const r = Math.round(239 + (38 - 239) * t);
    const g = Math.round(68 + (199 - 68) * t);
    const b = Math.round(68 + (252 - 68) * t);
    return `rgba(${r}, ${g}, ${b}, ${0.15 + t * 0.55})`;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card px-2 py-1.5 text-left text-muted-foreground">
              Model
            </th>
            {categories.map((c) => (
              <th key={c.id} className="px-2 py-1.5 text-center text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  {c.color && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                  )}
                  {c.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id} className="border-t border-border/50">
              <td className="sticky left-0 z-10 bg-card px-2 py-1.5 font-medium">
                {m.name}
              </td>
              {categories.map((c) => {
                const cell = cellMap.get(`${m.id}-${c.id}`);
                return (
                  <td
                    key={c.id}
                    className="px-2 py-1.5 text-center"
                    style={{
                      backgroundColor: colorForScore(cell?.avg_quality ?? null),
                      borderRadius: "4px",
                    }}
                    title={cell ? `${m.name} / ${c.name}: ${cell.avg_quality}/10 (${cell.entries} entries)` : ""}
                  >
                    {cell ? (
                      <span className="font-mono font-medium text-foreground">
                        {cell.avg_quality}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
