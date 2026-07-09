import { NavLink, Route, Routes } from "react-router-dom";
import { LayoutDashboard, PlusCircle, History, Cpu, Settings, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import Dashboard from "@/pages/Dashboard";
import Log from "@/pages/Log";
import HistoryPage from "@/pages/History";
import Models from "@/pages/Models";
import SettingsPage from "@/pages/Settings";
import AnalyticsPage from "@/pages/Analytics";
import { NotificationOverlay } from "@/components/NotificationOverlay";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/log", label: "New Log", icon: PlusCircle },
  { to: "/history", label: "History", icon: History },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/models", label: "Models", icon: Cpu },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function App() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/50 animate-slide-in">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="font-mono text-base font-bold text-primary">comp[AI]on</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          v0.1.0 — local only
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/log" element={<Log />} />
          <Route path="/log/:id" element={<Log />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/models" element={<Models />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <NotificationOverlay />
    </div>
  );
}
