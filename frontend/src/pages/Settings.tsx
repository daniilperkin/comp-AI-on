import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Save, Check } from "lucide-react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [reminderTime, setReminderTime] = useState("18:00");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Record<string, string>>("/settings")
      .then((s) => {
        if (s.reminder_time) setReminderTime(s.reminder_time);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.put("/settings", { reminder_time: reminderTime });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Notification and app preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Daily reminder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A once-daily check-in prompt at your chosen hour. The actual notification
            delivery (OS toast + in-browser overlay) arrives in Phase 3 — for now you can
            set the time and it's saved to the database.
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label>Reminder time</Label>
              <Input
                type="time"
                value={reminderTime}
                disabled={loading}
                onChange={(e) => setReminderTime(e.target.value)}
              />
            </div>
            <Button onClick={handleSave} disabled={saving || loading} className="gap-1">
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : saved ? "Saved" : "Save"}
            </Button>
          </div>
          <div className="rounded-md border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Send test notification</span>{" "}
              is disabled until Phase 3 (notification engine not built yet).
            </p>
            <Button variant="outline" disabled className="mt-2 opacity-50">
              Send test notification
            </Button>
          </div>
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
