import { useEffect, useRef, useState } from "react";
import { X, Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useDismissAllNotifications, useDismissNotification, usePendingNotifications } from "@/lib/queries";
import type { AppNotification } from "@/types";

const POLL_INTERVAL = 60_000;

export function NotificationOverlay() {
  const { data: notifs } = usePendingNotifications();
  const dismissOne = useDismissNotification();
  const dismissAll = useDismissAllNotifications();
  const [active, setActive] = useState<AppNotification[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function poll() {
    try {
      const fresh = await api.get<AppNotification[]>("/notifications");
      if (fresh.length > 0) {
        setActive((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const merged = [...prev, ...fresh.filter((n) => !existingIds.has(n.id))];
          return merged;
        });
      }
    } catch {
      // silent fail — notifications are non-critical
    }
  }

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL);

    const onVisibility = () => {
      if (document.hidden && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      } else if (!document.hidden && !timerRef.current) {
        poll();
        timerRef.current = setInterval(poll, POLL_INTERVAL);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

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
