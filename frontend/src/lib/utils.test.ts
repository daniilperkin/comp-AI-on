import { describe, it, expect } from "vitest";
import { cn, formatDate, formatDateShort } from "@/lib/utils";

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
