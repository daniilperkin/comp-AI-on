import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { useCategories, useModels } from "@/lib/queries";
import type { LogEntry } from "@/types";

interface LogTableProps {
  entries: LogEntry[];
  emptyHint?: string;
}

type SortKey = "date" | "model" | "score";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

/**
 * Column header button. Defined at module scope on purpose: a component
 * declared inside LogTable would be a new type on every render, which React
 * treats as a different component and remounts (and the lint rules reject).
 */
function SortLabel({
  column,
  label,
  sort,
  onToggle,
}: {
  column: SortKey;
  label: string;
  sort: SortState;
  onToggle: (key: SortKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
    >
      {label}
      {sort.key === column &&
        (sort.dir === "asc" ? (
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
        ))}
    </button>
  );
}

export function LogTable({ entries, emptyHint }: LogTableProps) {
  const navigate = useNavigate();
  // Rows animate in and out as a new entry lands or a filter changes. Auto
  // Animate keeps the DOM untouched — it only animates what already moved.
  const [animateRows] = useAutoAnimate<HTMLTableSectionElement>();
  const { data: modelsData } = useModels();
  const { data: categoriesData } = useCategories();

  const models = modelsData ?? [];
  const categories = categoriesData ?? [];

  const modelMap = new Map(models.map((m) => [m.id, m.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  function modelName(e: LogEntry): string {
    if (e.model_id) return modelMap.get(e.model_id) ?? "—";
    return e.model_name_text ?? "—";
  }

  function categoryLabel(
    e: LogEntry,
  ): { name: string; color: string | null } | null {
    if (e.category_id) {
      const c = categoryMap.get(e.category_id);
      if (c) return { name: c.name, color: c.color };
    }
    if (e.category_name_text)
      return { name: e.category_name_text, color: null };
    return null;
  }

  function outcomeVariant(o: LogEntry["outcome"]) {
    if (o === "solved") return "success" as const;
    if (o === "partial") return "warning" as const;
    if (o === "failed") return "destructive" as const;
    return "outline" as const;
  }

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "desc",
  });

  // Sorting is client-side over the rows this page already has. The API hands
  // back a page at a time, so a server-side ORDER BY would re-sort the whole
  // table out from under the pagination — worse than sorting what is visible.
  //
  // No useMemo here on purpose: the React Compiler already memoizes this
  // component, and a hand-written memo it cannot analyse is an error in this
  // repo's lint config.
  const nameOf = (e: LogEntry) =>
    (e.model_id ? modelMap.get(e.model_id) : e.model_name_text) ?? "—";
  const dir = sort.dir === "asc" ? 1 : -1;

  const sorted = [...entries].sort((a, b) => {
    if (sort.key === "date") {
      if (a.created_at === b.created_at) return 0;
      return (a.created_at < b.created_at ? -1 : 1) * dir;
    }
    if (sort.key === "model") return nameOf(a).localeCompare(nameOf(b)) * dir;

    // Rows with no score stay at the bottom in both directions: a score of
    // "—" is missing data, not a low score.
    const av = a.quality_score;
    const bv = b.quality_score;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * dir;
  });

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "date" ? "desc" : "asc" },
    );
  }

  function sortHeaderProps(key: SortKey) {
    return {
      "aria-sort":
        sort.key === key
          ? sort.dir === "asc"
            ? ("ascending" as const)
            : ("descending" as const)
          : ("none" as const),
    };
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        {emptyHint ?? "No entries yet."}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead {...sortHeaderProps("date")}>
              <SortLabel
                column="date"
                label="Date"
                sort={sort}
                onToggle={toggleSort}
              />
            </TableHead>
            <TableHead {...sortHeaderProps("model")}>
              <SortLabel
                column="model"
                label="Model"
                sort={sort}
                onToggle={toggleSort}
              />
            </TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="max-w-[280px]">Session / Task</TableHead>
            <TableHead {...sortHeaderProps("score")}>
              <SortLabel
                column="score"
                label="Score"
                sort={sort}
                onToggle={toggleSort}
              />
            </TableHead>
            <TableHead>Outcome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody ref={animateRows}>
          {sorted.map((e) => {
            const cat = categoryLabel(e);
            return (
              <TableRow
                key={e.id}
                className="cursor-pointer"
                onClick={() => navigate(`/log/${e.id}`)}
              >
                <TableCell className="whitespace-nowrap font-mono text-muted-foreground tabular-nums">
                  {formatDate(e.created_at)}
                </TableCell>
                <TableCell className="font-medium">{modelName(e)}</TableCell>
                <TableCell>
                  {cat ? (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      {cat.color && (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                      )}
                      {cat.name}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="max-w-[280px]">
                  {e.session_title ? (
                    <div className="min-w-0">
                      <p
                        className="truncate font-medium text-foreground"
                        title={e.session_title}
                      >
                        {e.session_title}
                      </p>
                      {e.task_description && (
                        <p
                          className="truncate text-xs text-muted-foreground/70"
                          title={e.task_description}
                        >
                          {e.task_description}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="block truncate text-muted-foreground">
                      {e.task_description ?? "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {e.quality_score !== null && e.quality_score !== undefined ? (
                    <span className="font-mono font-medium">
                      {e.quality_score}/10
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {e.outcome ? (
                    <Badge variant={outcomeVariant(e.outcome)}>
                      {e.outcome}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
