import { useState } from "react";
import { Link } from "react-router-dom";
import { LogTable } from "@/components/LogTable";
import { Select } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Download } from "lucide-react";
import { useCategories, useLogs, useModels } from "@/lib/queries";

export default function HistoryPage() {
  const { data: modelsData } = useModels();
  const { data: categoriesData } = useCategories();
  const [modelFilter, setModelFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const models = modelsData ?? [];
  const categories = categoriesData ?? [];

  const modelId = modelFilter ? Number(modelFilter) : undefined;
  const categoryId = categoryFilter ? Number(categoryFilter) : undefined;

  const { data: entries, isLoading, isError, error, refetch } = useLogs({
    limit: 500,
    modelId,
    categoryId,
  });

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
          <p className="text-sm text-muted-foreground">All log entries. Click any row to edit.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/log" className={cn(buttonVariants({ variant: "default" }), "gap-1")}>
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
          <Select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
            <option value="">All models</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
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
        <p className="text-muted-foreground">Loading…</p>
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <LogTable
          entries={entries ?? []}
          emptyHint="No entries match these filters."
        />
      )}
    </div>
  );
}
