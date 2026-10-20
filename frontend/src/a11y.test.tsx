import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";

import LogForm from "@/components/LogForm";
import Models from "@/pages/Models";

/**
 * Accessibility regression guard for the two densest forms in the app.
 *
 * The audit found every control in the Log form unnamed and 88 icon buttons in
 * the Models list without an accessible name. These tests run axe-core against
 * the rendered trees so the labels cannot silently disappear again.
 *
 * color-contrast is disabled: jsdom has no layout engine, so axe cannot
 * compute rendered colours (the palette is checked separately in DESIGN.md).
 */
const AXE_OPTIONS: axe.RunOptions = {
  rules: { "color-contrast": { enabled: false } },
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: true, status, json: async () => body } as Response;
}

const MODELS = [
  {
    id: 1,
    name: "GPT-5",
    kind: "web",
    vendor: "openai",
    is_active: true,
    input_price_per_mtok: 1,
    output_price_per_mtok: 2,
  },
  {
    id: 2,
    name: "Llama 3.1",
    kind: "local",
    vendor: "meta",
    is_active: false,
    input_price_per_mtok: null,
    output_price_per_mtok: null,
  },
];

const CATEGORIES = [{ id: 1, name: "Coding", color: "#888888" }];

function renderWithProviders(ui: React.ReactNode, initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/log" element={ui} />
          <Route path="/models" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function expectNoAxeViolations(container: HTMLElement) {
  const results = await axe.run(container, AXE_OPTIONS);
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`);
  expect(summary).toEqual([]);
}

describe("accessibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Log form has no unnamed controls", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/models")) return Promise.resolve(jsonResponse(MODELS));
      if (url.includes("/categories")) return Promise.resolve(jsonResponse(CATEGORIES));
      return Promise.resolve(jsonResponse([]));
    });

    const { container } = renderWithProviders(<LogForm />, "/log");
    await waitFor(() => expect(screen.getByLabelText(/quality score/i)).toBeInTheDocument());

    await expectNoAxeViolations(container);
  });

  it("Models list has no unnamed buttons", async () => {
    vi.spyOn(global, "fetch").mockImplementation(() => Promise.resolve(jsonResponse(MODELS)));

    const { container } = renderWithProviders(<Models />, "/models");
    await screen.findByText("GPT-5");

    expect(screen.getByRole("button", { name: "Edit GPT-5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Llama 3.1" })).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });
});
