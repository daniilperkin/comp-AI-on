import { lazy, Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { LayoutDashboard, PlusCircle, History, Cpu, Settings, BarChart3, Sun, Moon, Sparkles, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationOverlay } from "@/components/NotificationOverlay";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Log = lazy(() => import("@/pages/Log"));
const HistoryPage = lazy(() => import("@/pages/History"));
const AnalyticsPage = lazy(() => import("@/pages/Analytics"));
const Models = lazy(() => import("@/pages/Models"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const Recommender = lazy(() => import("@/pages/Recommender"));
const Compare = lazy(() => import("@/pages/Compare"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/log", label: "New Log", icon: PlusCircle },
  { to: "/history", label: "History", icon: History },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/recommender", label: "Recommender", icon: Sparkles },
  { to: "/compare", label: "Compare", icon: GitCompare },
  { to: "/models", label: "Models", icon: Cpu },
  { to: "/settings", label: "Settings", icon: Settings },
];

function PageFallback() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-muted-foreground">Loading…</p>
    </div>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/50 animate-slide-in">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="text-base font-bold tracking-tight text-foreground">comp<span className="text-muted-foreground">[AI]</span>on</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <button
            onClick={toggle}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-95"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <p className="mt-2 px-3 text-xs text-muted-foreground/60">v0.4.0 — local only</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/log" element={<Log />} />
              <Route path="/log/:id" element={<Log />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/recommender" element={<Recommender />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/models" element={<Models />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <NotificationOverlay />
    </div>
  );
}
