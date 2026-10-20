import { describe, it, expect } from "vitest";
import {
  cn,
  formatDate,
  formatDateShort,
  formatInt,
  formatNumber,
  shortcutLabel,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    const isHidden = false;
    const isVisible = true;
    expect(cn("base", isHidden && "hidden", isVisible && "visible")).toBe("base visible");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date string", () => {
    const result = formatDate("2026-01-15T14:30:00Z");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });

  it("includes time components", () => {
    const result = formatDate("2026-01-15T14:30:00Z");
    expect(result).toMatch(/\d/);
  });
});

describe("formatDateShort", () => {
  it("formats a valid ISO date string without time", () => {
    const result = formatDateShort("2026-01-15T14:30:00Z");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });
});

describe("locale pinning", () => {
  it("uses en-US separators regardless of the host locale", () => {
    expect(formatInt(1468)).toBe("1,468");
    expect(formatInt(88273)).toBe("88,273");
    expect(formatNumber(7.8)).toBe("7.8");
  });

  it("never emits German month abbreviations or decimal commas", () => {
    const date = formatDate("2026-10-20T12:07:00Z");
    expect(date).not.toMatch(/Okt|Dez|Mär/);
    expect(date).toMatch(/Oct/);
    expect(date).not.toMatch(/\d,\d/);
  });

  it("renders a dash for missing numbers", () => {
    expect(formatInt(null)).toBe("—");
    expect(formatInt(undefined)).toBe("—");
  });

  it("labels the palette shortcut for the current platform", () => {
    // jsdom reports an empty platform, i.e. not a Mac.
    expect(shortcutLabel("K")).toBe("Ctrl K");
  });
});
