import { useEffect, useState, useRef } from "react";
import { X, Bell } from "lucide-react";
import { api } from "@/lib/api";
import type { AppNotification } from "@/types";

const POLL_INTERVAL = 60_000;

export function NotificationOverlay() {
  const [active, setActive] = useState<AppNotification[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function poll() {
    try {
      const notifs = await api.get<AppNotification[]>("/notifications");
      if (notifs.length > 0) {
        setActive(notifs);
      }
    } catch {
      // silent fail — notifications are non-critical
    }
  }

  async function dismiss(id: number) {
    try {
      await api.patch(`/notifications/${id}/shown`, {});
    } catch {
      // ignore
    }
    setActive((prev) => prev.filter((n) => n.id !== id));
  }

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
    </div>
  );
}
