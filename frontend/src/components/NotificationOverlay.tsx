import { useEffect, useState } from "react";
import { X, Bell } from "lucide-react";
import { useDismissAllNotifications, useDismissNotification, usePendingNotifications } from "@/lib/queries";
import type { AppNotification } from "@/types";

export function NotificationOverlay() {
  const { data: notifs } = usePendingNotifications();
  const dismissOne = useDismissNotification();
  const dismissAll = useDismissAllNotifications();
  const [active, setActive] = useState<AppNotification[]>([]);

  // React Query refetches every 60s via refetchInterval in usePendingNotifications.
  // Merge new notifications into active state, deduplicating by ID.
  useEffect(() => {
    if (notifs && notifs.length > 0) {
      setActive((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const merged = [...prev, ...notifs.filter((n) => !existingIds.has(n.id))];
        return merged;
      });
    }
  }, [notifs]);

  async function dismiss(id: number) {
    try {
      await dismissOne.mutateAsync(id);
    } catch {
      // ignore
    }
    setActive((prev) => prev.filter((n) => n.id !== id));
  }

  async function dismissAllAndClear() {
    try {
      await dismissAll.mutateAsync();
    } catch {
      // ignore
    }
    setActive([]);
  }

  if (active.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {active.map((n) => (
        <div
          key={n.id}
          className="animate-slide-in flex w-80 items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-lg"
        >
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-semibold text-foreground">{n.title}</p>
            <p className="text-xs text-muted-foreground">{n.body}</p>
          </div>
          <button
            onClick={() => dismiss(n.id)}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {active.length > 1 && (
        <button
          onClick={dismissAllAndClear}
          className="self-end text-xs text-muted-foreground underline transition-colors hover:text-foreground"
        >
          Dismiss all
        </button>
      )}
    </div>
  );
}