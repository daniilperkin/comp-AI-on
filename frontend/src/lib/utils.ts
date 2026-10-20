import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * One locale for every app-level number and date.
 *
 * `undefined` means "whatever the host says", which on a German Windows box
 * renders 1468 as "1.468" and October as "Okt." inside an otherwise English
 * UI. Pinning en-US keeps separators, month names and AM/PM consistent
 * regardless of the machine's regional settings.
 */
export const LOCALE = "en-US";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(LOCALE, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(LOCALE, { month: "short", day: "numeric" });
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(LOCALE, options);
}

/** Integer with thousands separators ("88273" -> "88,273"). */
export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
}

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData;
  const platform = uaData?.platform || navigator.platform || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** "⌘K" on macOS, "Ctrl K" everywhere else. */
export function shortcutLabel(key: string): string {
  return isMac() ? `⌘${key}` : `Ctrl ${key}`;
}

/**
 * Format a USD cost for display. AI-call costs are typically fractions of a
 * cent, so cents-level rounding ($0.00) would erase them entirely — scale the
 * precision to the magnitude instead.
 */
export function formatCost(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) return "—";
  if (usd === 0) return "$0";
  if (usd >= 100) return `$${usd.toFixed(2)}`;
  if (usd >= 1) return `$${usd.toFixed(3)}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  // Sub-cent: enough significant digits to stay meaningful.
  return `$${usd.toPrecision(3)}`;
}
