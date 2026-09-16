import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Command, Menu, Moon, Sun, X } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { APP_NAV } from "@/lib/navigation";
import { CommandPalette, OPEN_PALETTE_EVENT } from "@/components/CommandPalette";
import { CaptureProvider } from "@/components/QuickCapture";
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

const nav = APP_NAV;

function PageFallback() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-muted-foreground">Loading…</p>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { theme, toggle } = useTheme();

  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="text-base font-bold tracking-tight text-foreground">comp<span className="text-muted-foreground">[AI]</span>on</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onNavigate}
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
          onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
          className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-95"
        >
          <Command className="h-4 w-4" />
          Command
          <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-95"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <p className="mt-2 px-3 text-xs text-muted-foreground/60">v0.4.0 — local only</p>
      </div>
    </>
  );
}

/**
 * Sonner's toaster, following the app theme rather than the OS preference so
 * toasts match the window they appear in.
 */
function AppToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-right" closeButton />;
}

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Close the mobile drawer on Escape while it is open.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <CaptureProvider>
      <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
        <span className="text-base font-bold tracking-tight text-foreground">comp<span className="text-muted-foreground">[AI]</span>on</span>
        <button
          onClick={() => setDrawerOpen((open) => !open)}
          aria-label={drawerOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={drawerOpen}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile overlay drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card lg:hidden">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="animate-slide-in hidden w-56 shrink-0 flex-col border-r border-border bg-card/50 lg:flex">
        <SidebarContent />
      </aside>

      <main className="min-w-0 flex-1 overflow-auto pb-6 pt-14 lg:pb-0 lg:pt-0">
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
      <CommandPalette />
      <AppToaster />
    </CaptureProvider>
  );
}
