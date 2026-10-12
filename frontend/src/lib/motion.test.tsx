import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MotionProvider, useMotion } from "./motion";

function stubMatchMedia(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("reduced-motion") ? reduced : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  });
}

function stubIntersectionObserver() {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
}

afterEach(() => {
  document.documentElement.classList.remove("motion");
  localStorage.clear();
  vi.unstubAllGlobals();
  stubMatchMedia(false);
});

describe("motion preference", () => {
  it("is off by default", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useMotion(), { wrapper: MotionProvider });
    expect(result.current.enabled).toBe(false);
    expect(document.documentElement.classList.contains("motion")).toBe(false);
  });

  it("activates the html class and persists when enabled", () => {
    stubMatchMedia(false);
    stubIntersectionObserver();
    const { result } = renderHook(() => useMotion(), { wrapper: MotionProvider });
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem("companion-motion")).toBe("on");
    expect(document.documentElement.classList.contains("motion")).toBe(true);
  });

  it("stays inert under prefers-reduced-motion even when enabled", () => {
    stubMatchMedia(true);
    stubIntersectionObserver();
    const { result } = renderHook(() => useMotion(), { wrapper: MotionProvider });
    act(() => result.current.setEnabled(true));
    expect(localStorage.getItem("companion-motion")).toBe("on");
    expect(document.documentElement.classList.contains("motion")).toBe(false);
  });

  it("bails out without IntersectionObserver", () => {
    stubMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", undefined);
    const { result } = renderHook(() => useMotion(), { wrapper: MotionProvider });
    act(() => result.current.setEnabled(true));
    expect(document.documentElement.classList.contains("motion")).toBe(false);
  });

  it("removes the class when disabled again", () => {
    stubMatchMedia(false);
    stubIntersectionObserver();
    const { result } = renderHook(() => useMotion(), { wrapper: MotionProvider });
    act(() => result.current.setEnabled(true));
    expect(document.documentElement.classList.contains("motion")).toBe(true);
    act(() => result.current.setEnabled(false));
    expect(document.documentElement.classList.contains("motion")).toBe(false);
    expect(localStorage.getItem("companion-motion")).toBe("off");
  });

  it("exposes the reveal-all escape hatch while active", () => {
    stubMatchMedia(false);
    stubIntersectionObserver();
    const { result } = renderHook(() => useMotion(), { wrapper: MotionProvider });
    act(() => result.current.setEnabled(true));
    const el = document.createElement("div");
    el.setAttribute("data-motion", "rise");
    document.body.appendChild(el);
    window.__companionRevealAll?.();
    expect(el.classList.contains("motion-in")).toBe(true);
    el.remove();
  });
});
