import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * Telemetry motion language — opt-in entrance choreography for data
 * surfaces. Off by default; enabling adds `html.motion` at runtime and
 * arms an IntersectionObserver that reveals `[data-motion]` elements once
 * as they enter the viewport. Bails entirely under prefers-reduced-motion
 * or without IntersectionObserver, leaving the app fully static.
 */

declare global {
  interface Window {
    /** QA / scripted-capture escape hatch: reveal everything at once. */
    __companionRevealAll?: () => void;
  }
}

interface MotionContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

const STORAGE_KEY = "companion-motion";
const ROOT_CLASS = "motion";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function getStored(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "on";
}

function initReveal(): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("motion-in");
          io.unobserve(entry.target);
        }
      }
    },
    // Negative bottom margin: reveal once the element is properly in
    // view, not while it still peeks over the fold.
    { rootMargin: "0px 0px -4% 0px", threshold: 0.1 }
  );

  const observe = (node: Element) => {
    if (node.matches("[data-motion]:not(.motion-in)")) io.observe(node);
    for (const el of node.querySelectorAll("[data-motion]:not(.motion-in)")) {
      io.observe(el);
    }
  };
  observe(document.body);

  // Route changes and late data mount new nodes; watch for them.
  const mo = new MutationObserver((records) => {
    for (const record of records) {
      for (const added of record.addedNodes) {
        if (added instanceof Element) observe(added);
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  window.__companionRevealAll = () => {
    for (const el of document.querySelectorAll("[data-motion]")) {
      el.classList.add("motion-in");
    }
  };

  return () => {
    io.disconnect();
    mo.disconnect();
    delete window.__companionRevealAll;
  };
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(getStored);
  const [reduced, setReduced] = useState<boolean>(
    () => window.matchMedia(REDUCE_QUERY).matches
  );

  // Follow the OS setting live: turning reduced-motion on mid-session
  // disarms the language instead of leaving half-played animations.
  useEffect(() => {
    const mq = window.matchMedia(REDUCE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const active = enabled && !reduced && typeof window.IntersectionObserver === "function";
    if (!active) {
      root.classList.remove(ROOT_CLASS);
      return;
    }
    root.classList.add(ROOT_CLASS);
    const cleanup = initReveal();
    return () => {
      cleanup();
      root.classList.remove(ROOT_CLASS);
    };
  }, [enabled, reduced]);

  const setEnabled = (value: boolean) => {
    setEnabledState(value);
    localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  };

  return (
    <MotionContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </MotionContext.Provider>
  );
}

export function useMotion(): MotionContextValue {
  const ctx = useContext(MotionContext);
  if (ctx === null) {
    throw new Error("useMotion must be used within a MotionProvider");
  }
  return ctx;
}
