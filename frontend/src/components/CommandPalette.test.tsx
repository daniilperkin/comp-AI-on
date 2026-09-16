import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CommandPalette } from "@/components/CommandPalette";
import { CaptureProvider } from "@/components/QuickCapture";
import { ThemeProvider } from "@/lib/theme";

/**
 * The palette is the one piece of UI every other screen depends on, so it is
 * tested through its real entry points (the keyboard) rather than by calling
 * its internals: open with Ctrl+K, act with the keyboard, and assert where the
 * app ends up.
 */

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

const MODELS = [
  { id: 1, name: "GPT-5", provider: "openai", is_active: true },
  { id: 2, name: "Claude Opus 5", provider: "anthropic", is_active: true },
];

function renderPalette() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <CaptureProvider>
            <Routes>
              <Route path="*" element={<LocationProbe />} />
            </Routes>
            <CommandPalette />
          </CaptureProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      const body = url.includes("/models") ? MODELS : [];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => body,
      } as Response);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens with Ctrl+K and lists every page", async () => {
    const user = userEvent.setup();
    renderPalette();

    expect(screen.queryByPlaceholderText(/search pages/i)).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");

    expect(await screen.findByPlaceholderText(/search pages/i)).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("navigates to the page that was picked", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard("{Control>}k{/Control}");
    const input = await screen.findByPlaceholderText(/search pages/i);
    await user.type(input, "history");
    await user.click(await screen.findByText("History"));

    expect(screen.getByTestId("path")).toHaveTextContent("/history");
  });

  it("starts a capture for a specific model from the model group", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByPlaceholderText(/search pages/i), "gpt");
    await user.click(await screen.findByText("GPT-5"));

    // The capture dialog opened by the palette, not the plain dashboard bar.
    expect(await screen.findByText(/quick capture/i)).toBeInTheDocument();
  });

  it("opens quick capture from anywhere with Alt+L", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard("{Alt>}l{/Alt}");

    expect(await screen.findByText(/quick capture/i)).toBeInTheDocument();
  });
});