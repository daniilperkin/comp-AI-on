import {
  BarChart3,
  Cpu,
  GitCompare,
  History,
  LayoutDashboard,
  PlusCircle,
  Settings,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The app's navigation, in one place.
 *
 * Both the sidebar and the command palette read this list — a page added here
 * shows up in both, which is the point: two separate lists would drift and the
 * palette would start lying about what the app can do.
 */
export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const APP_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/log", label: "New Log", icon: PlusCircle },
  { to: "/history", label: "History", icon: History },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/recommender", label: "Recommender", icon: Sparkles },
  { to: "/compare", label: "Compare", icon: GitCompare },
  { to: "/models", label: "Models", icon: Cpu },
  { to: "/settings", label: "Settings", icon: Settings },
];