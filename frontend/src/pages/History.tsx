import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LogTable } from "@/components/LogTable";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LogTableSkeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { QueryError } from "@/components/QueryError";
import { cn } from "@/lib/utils";
import { downloadExport } from "@/lib/api";
import { Plus, Download, Search } from "lucide-react";
import {
  LOGS_PAGE_SIZE,
  useCategories,
  useLogsPaged,
  useModels,
} from "@/lib/queries";

const PAGE_SIZES = [25, 50, 100, 200];

export default function HistoryPage() {
  const { data: modelsData } = useModels();
  const { data: categoriesData } = useCategories();

  // Filters live in the URL so a view can be bookmarked, shared or reloaded
  // without losing the selection. react-router's own searchParams is enough
  // here — nuqs would add an adapter for the same three lines.
  const [searchParams, setSearchParams] = useSearchParams();
  const modelFilter = searchParams.get("model") ?? "";
  const categoryFilter = searchParams.get("category") ?? "";
  const q = searchParams.get("q") ?? "";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";
  const unratedOnly = searchParams.get("unrated") === "1";
  const pageSize = PAGE_SIZES.includes(Number(searchParams.get("size")))
    ? Number(searchParams.get("size"))
    : LOGS_PAGE_SIZE;

  function setParam(key: string, value: string) {
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

  // The search box is debounced so typing does not fire a request per keystroke;
  // the URL stays the source of truth, so the effect only writes when the draft
  // actually differs from it.
  const [searchDraft, setSearchDraft] = useState(q);
  useEffect(() => {
    if (searchDraft === q) return;
    const handle = setTimeout(() => setParam("q", searchDraft.trim()), 300);
    return () => clearTimeout(handle);
    // setParam is recreated per render; the guard above keeps this loop-free.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft, q]);

  const models = modelsData ?? [];
  const categories = categoriesData ?? [];

  const modelId = modelFilter ? Number(modelFilter) : undefined;
  const categoryId = categoryFilter ? Number(categoryFilter) : undefined;

  const hasFilters = Boolean(
    modelFilter || categoryFilter || q || dateFrom || dateTo || unratedOnly || pageSize !== LOGS_PAGE_SIZE,
  );

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
  } = useLogsPaged(
    {
      modelId,
      categoryId,
      q: q || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      unrated: unratedOnly || undefined,
    },
    pageSize,
  );

  const exportFilters = {
    modelId,
    categoryId,
    q: q || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    unrated: unratedOnly || undefined,
  };

  function handleExport(format: "csv" | "json") {
    downloadExport(format, exportFilters);
  }

  function clearFilters() {
    setSearchDraft("");
    setSearchParams({}, { replace: true });
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
          <button
            type="button"
            onClick={() => handleExport("csv")}
            className={cn(buttonVariants({ variant: "outline" }), "gap-1")}
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport("json")}
            className={cn(buttonVariants({ variant: "outline" }), "gap-1")}
          >
            <Download className="h-4 w-4" /> JSON
          </button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search task, session, model or notes…"
              aria-label="Search entries"
              className="h-9 pl-8"
            />
          </div>

          <div className="min-w-[180px]">
            <Select
              aria-label="Filter by model"
              value={modelFilter}
              onChange={(e) => setParam("model", e.target.value)}
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
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setParam("category", e.target.value)}
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

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="history-from" className="text-xs text-muted-foreground">
              From
            </label>
            <Input
              id="history-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setParam("from", e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="history-to" className="text-xs text-muted-foreground">
              To
            </label>
            <Input
              id="history-to"
              type="date"
              value={dateTo}
              onChange={(e) => setParam("to", e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>

          <div className="flex items-center gap-2 pb-2">
            <Switch
              checked={unratedOnly}
              onCheckedChange={(value) => setParam("unrated", value ? "1" : "")}
              label="Unrated only"
            />
            <span className="text-sm">Unrated only</span>
          </div>

          <div className="ml-auto flex items-center gap-2 pb-1">
            <label htmlFor="history-size" className="text-xs text-muted-foreground">
              Per page
            </label>
            <Select
              id="history-size"
              value={String(pageSize)}
              onChange={(e) => setParam("size", e.target.value)}
              className="h-9 w-[90px]"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Clear filters
              </button>
            )}
          </div>
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
                : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total}`}
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
