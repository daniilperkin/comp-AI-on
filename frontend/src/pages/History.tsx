import { Link, useSearchParams } from "react-router-dom";
import { LogTable } from "@/components/LogTable";
import { Select } from "@/components/ui/select";
import { LogTableSkeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { QueryError } from "@/components/QueryError";
import { cn } from "@/lib/utils";
import { Plus, Download } from "lucide-react";
import {
  LOGS_PAGE_SIZE,
  useCategories,
  useLogsPaged,
  useModels,
} from "@/lib/queries";

export default function HistoryPage() {
  const { data: modelsData } = useModels();
  const { data: categoriesData } = useCategories();

  // Filters live in the URL so a view can be bookmarked, shared or reloaded
  // without losing the selection. react-router's own searchParams is enough
  // here — nuqs would add an adapter for the same three lines.
  const [searchParams, setSearchParams] = useSearchParams();
  const modelFilter = searchParams.get("model") ?? "";
  const categoryFilter = searchParams.get("category") ?? "";

  function setFilter(key: "model" | "category", value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  const models = modelsData ?? [];
  const categories = categoriesData ?? [];

  const modelId = modelFilter ? Number(modelFilter) : undefined;
  const categoryId = categoryFilter ? Number(categoryFilter) : undefined;

  const {
    entries,
    total,
    page,
    pageCount,
    isLoading,
    isError,
    error,
    refetch,
    prevPage,
    nextPage,
  } = useLogsPaged({ modelId, categoryId });

  function exportUrl(format: "csv" | "json") {
    const params = new URLSearchParams();
    if (modelFilter) params.set("model_id", modelFilter);
    if (categoryFilter) params.set("category_id", categoryFilter);
    const qs = params.toString();
    return `/api/logs/export/${format}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">History</h1>
          <p className="text-sm text-muted-foreground">
            All log entries. Click any row to edit.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/log"
            className={cn(buttonVariants({ variant: "default" }), "gap-1")}
          >
            <Plus className="h-4 w-4" /> New entry
          </Link>
          <a
            href={exportUrl("csv")}
            download
            className={cn(buttonVariants({ variant: "outline" }), "gap-1")}
          >
            <Download className="h-4 w-4" /> CSV
          </a>
          <a
            href={exportUrl("json")}
            download
            className={cn(buttonVariants({ variant: "outline" }), "gap-1")}
          >
            <Download className="h-4 w-4" /> JSON
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[180px]">
          <Select
            value={modelFilter}
            onChange={(e) => setFilter("model", e.target.value)}
          >
            <option value="">All models</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Select
            value={categoryFilter}
            onChange={(e) => setFilter("category", e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <LogTableSkeleton rows={8} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <LogTable
            entries={entries}
            emptyHint="No entries match these filters."
          />
          <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
            <span>
              {total === 0
                ? "0 entries"
                : `${page * LOGS_PAGE_SIZE + 1}–${Math.min((page + 1) * LOGS_PAGE_SIZE, total)} of ${total}`}
            </span>
            {pageCount > 1 && (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1",
                  )}
                  onClick={prevPage}
                  disabled={page === 0}
                >
                  ← Prev
                </button>
                <span>
                  Page {page + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1",
                  )}
                  onClick={nextPage}
                  disabled={page >= pageCount - 1}
                >
                  Next →
                </button>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
