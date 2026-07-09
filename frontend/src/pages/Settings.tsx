import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Save, Check, Monitor, Globe, Send } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChannelConfig {
  key: string;
  label: string;
  icon: typeof Monitor;
  description: string;
}

const CHANNELS: ChannelConfig[] = [
  {
    key: "channel_os_toast",
    label: "OS toast",
    icon: Monitor,
    description: "Native Windows toast notification via BurntToast",
  },
  {
    key: "channel_browser_overlay",
    label: "In-browser overlay",
    icon: Globe,
    description: "Toast appears in the bottom-right of the app",
  },
];

export default function SettingsPage() {
  const [reminderTime, setReminderTime] = useState("18:00");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [channels, setChannels] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Record<string, string>>("/settings")
      .then((s) => {
        if (s.reminder_time) setReminderTime(s.reminder_time);
        setReminderEnabled(s.reminder_enabled !== "false");
        const ch: Record<string, boolean> = {};
        for (const c of CHANNELS) {
          ch[c.key] = s[c.key] !== "false";
        }
        setChannels(ch);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setTestResult(null);
    try {
      await api.put("/settings", {
        reminder_time: reminderTime,
        reminder_enabled: reminderEnabled ? "true" : "false",
        ...Object.fromEntries(
          CHANNELS.map((c) => [c.key, channels[c.key] ? "true" : "false"])
        ),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(channel: string) {
    setTesting(channel);
    setTestResult(null);
    try {
      const res = await api.post<{ success: boolean; channel: string }>(
        "/notifications/test",
        { channel }
      );
      setTestResult(res.success ? "sent" : "failed");
      setTimeout(() => setTestResult(null), 3000);
    } catch {
      setTestResult("failed");
      setTimeout(() => setTestResult(null), 3000);
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Notification and app preferences.</p>
      </div>

      {/* Daily reminder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Daily reminder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A once-daily check-in at your chosen hour. Fires only if you haven't logged
            an entry for that day.
          </p>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Reminder time</Label>
              <Input
                type="time"
                value={reminderTime}
                disabled={loading}
                onChange={(e) => setReminderTime(e.target.value)}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm">Enabled</span>
            </label>

            <Button onClick={handleSave} disabled={saving || loading} className="gap-1">
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : saved ? "Saved" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification channels */}
      <Card>
        <CardHeader>
          <CardTitle>Notification channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const enabled = channels[ch.key] ?? false;
            return (
              <div
                key={ch.key}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-4 transition-colors",
                  enabled ? "border-primary/30 bg-primary/5" : "border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full",
                      enabled ? "bg-primary/15" : "bg-muted"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", enabled ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ch.label}</p>
                    <p className="text-xs text-muted-foreground">{ch.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => setChannels((prev) => ({ ...prev, [ch.key]: !enabled }))}
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      enabled ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                        enabled ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
                  </button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testing === ch.key}
                    onClick={() => handleTest(ch.key === "channel_os_toast" ? "os_toast" : "browser_overlay")}
                    className="gap-1"
                  >
                    <Send className="h-3 w-3" />
                    {testing === ch.key ? "Testing..." : "Test"}
                  </Button>
                </div>
              </div>
            );
          })}

          {testResult && (
            <p
              className={cn(
                "text-sm",
                testResult === "sent" ? "text-emerald-400" : "text-destructive"
              )}
            >
              {testResult === "sent"
                ? "Notification sent — check if it appeared."
                : "Failed to send notification."}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Changes to channels are saved when you click "Save" in the Daily reminder section above.
          </p>
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All data lives in{" "}
            <code className="rounded bg-secondary px-1">backend/database.db</code>. Delete
            the file and restart to reset everything back to seeded defaults.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
