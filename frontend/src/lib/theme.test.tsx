import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/lib/theme";

function renderThemeProvider() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );
  return wrapper;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to system theme", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: renderThemeProvider(),
    });
    expect(["light", "dark"]).toContain(result.current.theme);
  });

  it("toggles theme", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: renderThemeProvider(),
    });
    const initial = result.current.theme;
    act(() => result.current.toggle());
    expect(result.current.theme).toBe(initial === "dark" ? "light" : "dark");
  });

  it("persists to localStorage on toggle", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: renderThemeProvider(),
    });
    act(() => result.current.toggle());
    expect(localStorage.getItem("companion-theme")).toBe(result.current.theme);
  });

  it("applies dark class to documentElement when dark", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: renderThemeProvider(),
    });
    act(() => {
      if (result.current.theme !== "dark") result.current.toggle();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes dark class when light", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: renderThemeProvider(),
    });
    act(() => {
      if (result.current.theme !== "light") result.current.toggle();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("throws when used outside provider", () => {
    expect(() => renderHook(() => useTheme())).toThrow("useTheme must be used within a ThemeProvider");
  });
});
