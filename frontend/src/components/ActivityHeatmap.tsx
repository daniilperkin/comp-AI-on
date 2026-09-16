import { useMemo } from "react";
import { ActivityCalendar } from "react-activity-calendar";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStatsTimeline } from "@/lib/queries";
import { useTheme } from "@/lib/theme";
import type { TimelinePoint } from "@/types";

/** Half a year: long enough to show a habit, short enough to stay readable. */
const WINDOW_DAYS = 182;

/**
 * Warm paper → ink ramp for light mode, card greys → warm ink for dark. Index 0
 * is "no entries that day", so it stays close to the surface colour.
 */
const CALENDAR_THEME = {
  light: ["#ece5d8", "#d9cdb4", "#b9a685", "#8a7a5f", "#4a4234"],
  dark: ["#1c1c1c", "#3a352c", "#5f5540", "#8a7a5f", "#cbbfa6"],
};

/** Counts here are small (a handful of sessions a day), so fixed steps beat quartiles. */
function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Build one entry per calendar day so the graph always shows the full window,
 * even when a stretch of days has no entries at all. The backend groups by
 * SQLite's `date(created_at)` (UTC-naive), so a late-night session can land on
 * the next day here — acceptable for a habit view, and noted rather than hidden.
 */
function buildCalendar(rows: TimelinePoint[], days: number) {
  const counts = new Map(rows.map((row) => [row.date, row.count]));
  const today = new Date();
  const calendar: Array<{ date: string; count: number; level: number }> = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = isoDay(date);
    const count = counts.get(key) ?? 0;
    calendar.push({ date: key, count, level: levelFor(count) });
  }

  return calendar;
}

export function ActivityHeatmap() {
  const { data, isLoading, isError } = useStatsTimeline(WINDOW_DAYS);
  const { theme } = useTheme();

  const calendar = useMemo(() => buildCalendar(data ?? [], WINDOW_DAYS), [data]);
  const total = useMemo(() => calendar.reduce((sum, day) => sum + day.count, 0), [calendar]);
  const activeDays = useMemo(() => calendar.filter((day) => day.count > 0).length, [calendar]);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="flex flex-row items-baseline justify-between">
        <CardTitle>Logging activity</CardTitle>
        <p className="text-xs text-muted-foreground">
          {activeDays} active {activeDays === 1 ? "day" : "days"} · {total} entries
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[110px] w-full" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">
            Could not load activity for the last six months.
          </p>
        ) : (
          <ActivityCalendar
            data={calendar}
            theme={CALENDAR_THEME}
            colorScheme={theme}
            blockSize={11}
            blockMargin={3}
            blockRadius={2}
            fontSize={12}
            showWeekdayLabels
            labels={{ totalCount: "{{count}} entries in the last 6 months" }}
          />
        )}
      </CardContent>
    </Card>
  );
}