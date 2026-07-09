import { useEffect, useState } from "react";
import { LogTable } from "@/components/LogTable";
import { useModelsCategories } from "@/components/QuickAddBar";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { LogEntry } from "@/types";

export default function HistoryPage() {
  const { models, categories } = useModelsCategories();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [modelFilter, setModelFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "500");
      if (modelFilter) params.set("model_id", modelFilter);
      if (categoryFilter) params.set("category_id", categoryFilter);
      const data = await api.get<LogEntry[]>(`/logs?${params}`);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [modelFilter, categoryFilter]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">History</h1>
          <p className="text-sm text-muted-foreground">All log entries. Click any row to edit.</p>
        </div>
        <Button onClick={() => (window.location.href = "/log")}>New entry</Button>
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

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <LogTable
          entries={entries}
          models={models}
          categories={categories}
          emptyHint="No entries match these filters."
        />
      )}
    </div>
  );
}
