import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Save, Check, Monitor, Globe, Send, MessageCircle, Bot, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSettings,
  useUpdateSettings,
  useRunSync,
  useSyncStatus,
  useHermesSyncStatus,
  useRunHermesSync,
} from "@/lib/queries";
import type { HermesSyncResult, SyncResult } from "@/lib/queries";
import { api } from "@/lib/api";
import { useMotion } from "@/lib/motion";

interface ChannelConfig {
  key: string;
  label: string;
  icon: typeof Monitor;
  description: string;
  testChannel: string;
  webhookUrlKey?: string;
  webhookUrlLabel?: string;
  webhookUrlPlaceholder?: string;
}

const CHANNELS: ChannelConfig[] = [
  {
    key: "channel_os_toast",
    label: "OS toast",
    icon: Monitor,
    description: "Native Windows toast notification via BurntToast",
    testChannel: "os_toast",
  },
  {
    key: "channel_browser_overlay",
    label: "In-browser overlay",
    icon: Globe,
    description: "Toast appears in the bottom-right of the app",
    testChannel: "browser_overlay",
  },
  {
    key: "channel_telegram",
    label: "Telegram",
    icon: Send,
    description: "Send via Telegram bot webhook",
    testChannel: "telegram",
    webhookUrlKey: "telegram_webhook_url",
    webhookUrlLabel: "Telegram webhook URL",
    webhookUrlPlaceholder: "https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>",
  },
  {
    key: "channel_discord",
    label: "Discord",
    icon: MessageCircle,
    description: "Send via Discord webhook",
    testChannel: "discord",
    webhookUrlKey: "discord_webhook_url",
    webhookUrlLabel: "Discord webhook URL",
    webhookUrlPlaceholder: "https://discord.com/api/webhooks/<id>/<token>",
  },
];

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { enabled: motionEnabled, setEnabled: setMotionEnabled } = useMotion();

  const [reminderTime, setReminderTime] = useState("18:00");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [dailyBudget, setDailyBudget] = useState("");
  const [channels, setChannels] = useState<Record<string, boolean>>({});
  const [webhookUrls, setWebhookUrls] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // OpenRouter sync
  const syncStatusQ = useSyncStatus();
  const runSync = useRunSync();
  const [syncApiKey, setSyncApiKey] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | { ok: false; error: string } | null>(null);

  // Hermes usage sync
  const hermesStatusQ = useHermesSyncStatus();
  const runHermesSync = useRunHermesSync();
  const [hermesSyncEnabled, setHermesSyncEnabled] = useState(true);
  const [hermesResult, setHermesResult] = useState<HermesSyncResult | null>(null);

  useEffect(() => {
    if (!settings) return;
    if (settings.reminder_time) setReminderTime(settings.reminder_time);
    setReminderEnabled(settings.reminder_enabled !== "false");
    setDailyBudget(settings.daily_budget_usd ?? "");
    // The backend returns a masked key; never echo it into the input.
    setSyncApiKey("");
    setSyncEnabled(settings.openrouter_sync_enabled !== "false");
    setHermesSyncEnabled(settings.hermes_sync_enabled !== "false");
    const ch: Record<string, boolean> = {};
    const wh: Record<string, string> = {};
    for (const c of CHANNELS) {
      ch[c.key] = settings[c.key] !== "false";
      if (c.webhookUrlKey) {
        wh[c.webhookUrlKey] = settings[c.webhookUrlKey] ?? "";
      }
    }
    setChannels(ch);
    setWebhookUrls(wh);
  }, [settings]);

  // Keep the sync status (has_api_key / last_sync_at) fresh after saves.
  const syncStatus = syncStatusQ.data;
  const syncRunning = runSync.isPending;
  const lastSyncAt =
    syncResult?.ok && syncResult.last_sync_at
      ? syncResult.last_sync_at
      : syncStatus?.last_sync_at ?? null;
  useEffect(() => {
    if (!syncStatusQ.data) return;
    setSyncEnabled(syncStatusQ.data.enabled);
  }, [syncStatusQ.data]);

  const hermesStatus = hermesStatusQ.data;
  const hermesRunning = runHermesSync.isPending;
  const lastHermesSyncAt =
    hermesResult?.ok && hermesResult.last_sync_at
      ? hermesResult.last_sync_at
      : hermesStatus?.last_sync_at ?? null;
  useEffect(() => {
    if (!hermesStatusQ.data) return;
    setHermesSyncEnabled(hermesStatusQ.data.enabled);
  }, [hermesStatusQ.data]);

  const saving = updateSettings.isPending;

  async function handleSave() {
    setSaved(false);
    setTestResult(null);
    const payload: Record<string, string | boolean> = {
      reminder_time: reminderTime,
      reminder_enabled: reminderEnabled ? "true" : "false",
      daily_budget_usd: dailyBudget.trim(),
      openrouter_sync_enabled: syncEnabled ? "true" : "false",
      hermes_sync_enabled: hermesSyncEnabled ? "true" : "false",
    };
    if (syncApiKey.trim()) payload.openrouter_api_key = syncApiKey.trim();
    for (const c of CHANNELS) {
      payload[c.key] = channels[c.key] ? "true" : "false";
      if (c.webhookUrlKey) {
        payload[c.webhookUrlKey] = webhookUrls[c.webhookUrlKey] ?? "";
      }
    }
    await updateSettings.mutateAsync(payload);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

  async function handleSyncNow() {
    // Save the key first so the backend sees it — a sync with an unsaved key
    // would confusingly fail right after the user typed it.
    await handleSave();
    setSyncResult(null);
    try {
      const res = await runSync.mutateAsync(7);
      setSyncResult(res);
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : "Sync failed — is the backend running?";
      setSyncResult({ ok: false, error: detail });
    }
  }

  async function handleHermesSyncNow() {
    // Persist the toggle first so a disabled→enabled flip is respected.
    await handleSave();
    setHermesResult(null);
    try {
      const res = await runHermesSync.mutateAsync();
      setHermesResult(res);
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : "Sync failed — is the backend running?";
      setHermesResult({ ok: false, created: 0, updated: 0, unchanged: 0, errors: 0, error: detail });
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Notification and app preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border p-4 transition-colors",
              motionEnabled ? "border-primary/30 bg-primary/5" : "border-border"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  motionEnabled ? "bg-primary/15" : "bg-muted"
                )}
              >
                <Activity
                  className={cn("h-4 w-4", motionEnabled ? "text-primary" : "text-muted-foreground")}
                />
              </div>
              <div>
                <p className="text-sm font-medium">Motion effects</p>
                <p className="text-xs text-muted-foreground">
                  Telemetry sweep: cards rise in, charts plot in, and a scan
                  sheen follows the pointer across stat cards. Applies instantly
                  and is stored locally; always off while your system requests
                  reduced motion.
                </p>
              </div>
            </div>

            <button
              role="switch"
              aria-checked={motionEnabled}
              aria-label="Motion effects"
              onClick={() => setMotionEnabled(!motionEnabled)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                motionEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0 h-5 w-5 rounded-full bg-background shadow-sm transition-transform",
                  motionEnabled ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

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
                disabled={isLoading}
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

            <Button onClick={handleSave} disabled={saving || isLoading} className="gap-1">
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : saved ? "Saved" : "Save"}
            </Button>
          </div>

          <div className="space-y-1.5 pt-2">
            <Label>Daily budget (USD)</Label>
            <Input
              type="number"
              step="any"
              min="0"
              className="max-w-48"
              value={dailyBudget}
              disabled={isLoading}
              onChange={(e) => setDailyBudget(e.target.value)}
              placeholder="empty = no budget"
            />
            <p className="text-xs text-muted-foreground">
              When today's derived spend crosses this amount, you get one
              warning per day through your enabled channels. Leave empty to disable.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const enabled = channels[ch.key] ?? false;
            return (
              <div key={ch.key}>
                <div
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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testing === ch.key}
                    onClick={() => handleTest(ch.testChannel)}
                    className="gap-1"
                  >
                    <Send className="h-3 w-3" />
                    {testing === ch.key ? "Testing..." : "Test"}
                  </Button>

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
                        "absolute top-0.5 left-0 h-5 w-5 rounded-full bg-background shadow-sm transition-transform",
                        enabled ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
                </div>

                {ch.webhookUrlKey && ch.webhookUrlLabel && enabled && (
                  <div className="mt-3 pl-12">
                    <Label className="text-xs">{ch.webhookUrlLabel}</Label>
                    <Input
                      value={webhookUrls[ch.webhookUrlKey] ?? ""}
                      onChange={(e) =>
                        setWebhookUrls((prev) => ({
                          ...prev,
                          [ch.webhookUrlKey!]: e.target.value,
                        }))
                      }
                      placeholder={ch.webhookUrlPlaceholder}
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {testResult && (
            <p
              className={cn(
                "text-sm",
                testResult === "sent" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            OpenRouter usage sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>API key</Label>
              <Input
                type="password"
                className="w-72 font-mono text-xs"
                value={syncApiKey}
                disabled={isLoading}
                onChange={(e) => setSyncApiKey(e.target.value)}
                placeholder={settings?.openrouter_api_key || "sk-or-v1-…"}
                aria-label="OpenRouter API key"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={syncEnabled}
                onChange={(e) => setSyncEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm">Enabled</span>
            </label>

            <Button onClick={handleSave} disabled={saving || isLoading} className="gap-1">
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : saved ? "Saved" : "Save key"}
            </Button>

            <Button
              variant="outline"
              onClick={handleSyncNow}
              disabled={!syncStatus?.has_api_key || syncRunning}
              className="gap-1"
            >
              {syncRunning ? "Syncing…" : "Sync now (7d)"}
            </Button>

            {syncStatus?.has_api_key && (
              <Button
                variant="ghost"
                onClick={() => updateSettings.mutate({ clear_openrouter_api_key: true })}
                disabled={saving}
              >
                Remove key
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {lastSyncAt
              ? `Last sync: ${new Date(lastSyncAt).toLocaleString()}`
              : "Never synced."}{" "}
            Imported entries are marked "auto-imported" — re-syncs skip what was
            already imported. The key is stored server-side and never shown again in full. Activity is
            aggregated per day and model (last 30 completed UTC days).
          </p>

          {syncResult && (
            <p className={cn("text-sm", syncResult.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
              {syncResult.ok
                ? `Imported ${syncResult.created} entr${syncResult.created === 1 ? "y" : "ies"} (${syncResult.skipped_existing} already present${syncResult.errors ? `, ${syncResult.errors} unusable` : ""}).`
                : syncResult.error}
            </p>
          )}

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Hermes usage sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Imports local Hermes Agent usage from every profile's state.db —
            one entry per session × model × task, with tokens, cache reads and
            estimated cost. Runs on app start and every 30 minutes. Imported
            entries are marked "auto-imported (hermes)" and carry no quality
            score until you rate them.
          </p>

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={hermesSyncEnabled}
                onChange={(e) => setHermesSyncEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm">Enabled</span>
            </label>

            <Button onClick={handleSave} disabled={saving || isLoading} className="gap-1">
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : saved ? "Saved" : "Save"}
            </Button>

            <Button
              variant="outline"
              onClick={handleHermesSyncNow}
              disabled={hermesRunning || !hermesStatus?.profiles_found.length}
              className="gap-1"
            >
              {hermesRunning ? "Syncing…" : "Sync now"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {hermesStatus
              ? `${hermesStatus.profiles_found.length} profile${hermesStatus.profiles_found.length === 1 ? "" : "s"} found${
                  hermesStatus.hermes_home ? ` (${hermesStatus.hermes_home})` : ""
                }`
              : "Checking for Hermes profiles…"}{" "}
            {hermesStatus &&
              (lastHermesSyncAt
                ? `· Last sync: ${new Date(lastHermesSyncAt).toLocaleString()}`
                : "· Never synced.")}
          </p>

          {hermesResult && (
            <p
              className={cn(
                "text-sm",
                hermesResult.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
              )}
            >
              {hermesResult.ok
                ? `Imported ${hermesResult.created} new, updated ${hermesResult.updated}, ${hermesResult.unchanged} unchanged${
                    hermesResult.errors ? `, ${hermesResult.errors} unusable` : ""
                  }.`
                : hermesResult.error}
            </p>
          )}
        </CardContent>
      </Card>

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
