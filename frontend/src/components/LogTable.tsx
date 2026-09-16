import { useNavigate } from "react-router-dom";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { useCategories, useModels } from "@/lib/queries";
import type { LogEntry } from "@/types";

interface LogTableProps {
  entries: LogEntry[];
  emptyHint?: string;
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

  function categoryLabel(e: LogEntry): { name: string; color: string | null } | null {
    if (e.category_id) {
      const c = categoryMap.get(e.category_id);
      if (c) return { name: c.name, color: c.color };
    }
    if (e.category_name_text) return { name: e.category_name_text, color: null };
    return null;
  }

  function outcomeVariant(o: LogEntry["outcome"]) {
    if (o === "solved") return "success" as const;
    if (o === "partial") return "warning" as const;
    if (o === "failed") return "destructive" as const;
    return "outline" as const;
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
            <TableHead>Date</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="max-w-[280px]">Task</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Outcome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody ref={animateRows}>
          {entries.map((e) => {
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
                <TableCell className="max-w-[280px] truncate text-muted-foreground">
                  {e.task_description ?? "—"}
                </TableCell>
                <TableCell>
                  {e.quality_score !== null && e.quality_score !== undefined ? (
                    <span className="font-mono font-medium">{e.quality_score}/10</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {e.outcome ? (
                    <Badge variant={outcomeVariant(e.outcome)}>{e.outcome}</Badge>
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
