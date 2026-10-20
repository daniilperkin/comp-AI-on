import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { QueryError } from "@/components/QueryError";
import { cn, formatCost } from "@/lib/utils";
import { Download, TrendingUp, Trophy, Grid3x3 } from "lucide-react";
import {
  useStatsLeaderboard,
  useStatsMatrix,
  useStatsTimeline,
} from "@/lib/queries";
import { useTheme } from "@/lib/theme";
import { useMemo, useState } from "react";
import type { MatrixData, MatrixCell } from "@/types";

const CHART_HEIGHT = 280;

/**
 * Truncate from the middle, never the front.
 *
 * Model ids share long prefixes ("deepseek/deepseek-v4.1-flash-1017"), so a
 * trailing ellipsis cut the one part that tells them apart. Keeping both ends
 * means the family and the variant stay readable; the tooltip carries the
 * full id.
 */
function middleEllipsis(value: string, max: number): string {
  if (!value || value.length <= max) return value;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

// Read a CSS custom property off :root at render time. Re-computed whenever
// the theme flips so charts always track the active palette.
function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(() => {
    const isDark = theme === "dark";
    // Raw "H S% L%" components of the theme's primary color (see index.css).
    const primary = readCssVar("--primary", isDark ? "40 33% 96%" : "0 0% 15%");
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
      primary,
      area: `hsl(${primary})`,
    };
  }, [theme]);
}

export default function AnalyticsPage() {
  const chartTheme = useChartTheme();
  const [timelineDays, setTimelineDays] = useState<number | null>(30);
  const timelineQ = useStatsTimeline(timelineDays ?? undefined);
  const leaderboardQ = useStatsLeaderboard();
  const matrixQ = useStatsMatrix();

  const loading = !timelineQ.data || !leaderboardQ.data || !matrixQ.data;

  const firstError = timelineQ.error ?? leaderboardQ.error ?? matrixQ.error;
  if (firstError) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Which models win at which tasks.
          </p>
        </div>
        <QueryError
          error={firstError}
          onRetry={() => {
            timelineQ.refetch();
            leaderboardQ.refetch();
            matrixQ.refetch();
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">Loading analytics…</p>
      </div>
    );
  }

  const timeline = timelineQ.data;
  const leaderboard = leaderboardQ.data;
  const matrix = matrixQ.data;

  const hasData = (timeline?.length ?? 0) > 0 || (leaderboard?.length ?? 0) > 0;

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
          <a
            href={`/api/logs/export/csv`}
            download
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <a
            href={`/api/logs/export/json`}
            download
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Download className="h-3.5 w-3.5" /> JSON
          </a>
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
          <Card data-motion="rise" className="animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Daily entry timeline
              </CardTitle>
              <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
                {([7, 30, 90, null] as const).map((d) => (
                  <button
                    key={d === null ? "all" : d}
                    type="button"
                    aria-pressed={timelineDays === d}
                    onClick={() => setTimelineDays(d)}
                    className={cn(
                      "rounded px-2.5 py-1 transition-colors",
                      timelineDays === d
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d === null ? "All" : `${d}d`}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent data-motion="plot">
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
            <Card data-motion="rise" className="animate-fade-in" style={{ animationDelay: "100ms" }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Model leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent data-motion="plot">
                {leaderboard && leaderboard.length > 0 ? (
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
                        width={190}
                        tickFormatter={(value: string) => middleEllipsis(value, 26)}
                      />
                      <Tooltip
                        contentStyle={chartTheme.tooltip}
                        formatter={(value, name, item) => {
                          if (name === "Avg quality" && item?.payload) {
                            const p = item.payload as { total_cost?: number };
                            return [`${value} / 10 · ${formatCost(p.total_cost ?? null)} spent`, name];
                          }
                          return [value, name];
                        }}
                      />
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

            <Card data-motion="rise" className="animate-fade-in lg:col-span-2" style={{ animationDelay: "200ms" }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Grid3x3 className="h-4 w-4 text-primary" />
                  Model vs category
                </CardTitle>
              </CardHeader>
              <CardContent data-motion="plot">
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
  const { primary } = useChartTheme();

  const cellMap = new Map<string, MatrixCell>();
  for (const c of cells) {
    cellMap.set(`${c.model_id}-${c.category_id}`, c);
  }

  function colorForScore(score: number | null): string {
    if (score === null) return "transparent";
    // Colorblind-safe sequential ramp: instead of interpolating between two
    // hues (red→green is indistinguishable for deuteranopia/protanopia),
    // scale the theme's primary hue in OPACITY only — low scores sit near
    // the background, high ones approach full primary saturation. A single
    // hue varying in intensity is readable under every common CVD type.
    const t = score / 10;
    const alpha = 0.12 + t * 0.78;
    return `hsl(${primary} / ${alpha.toFixed(2)})`;
  }

  return (
    <div
      className="overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label="Model vs category matrix"
    >
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
