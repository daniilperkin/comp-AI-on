import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { QuickAddBar } from "@/components/QuickAddBar";

/**
 * The undo path is the reason the toast exists: the entry is already on the
 * server by the time the toast appears, so "Undo" has to issue a real DELETE
 * against the row we just created. That is asserted here against the fetch
 * call, not against a mocked hook.
 */

const MODELS = [{ id: 1, name: "GPT-5", provider: "openai", is_active: true }];

const CREATED = {
  id: 42,
  model_id: 1,
  model_name_text: null,
  category_id: null,
  quality_score: 8,
  outcome: "solved",
  task_description: "summarise a paper",
  created_at: "2026-09-16T10:00:00",
  cost_usd: null,
  tokens_in: null,
  tokens_out: null,
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: true, status, json: async () => body } as Response;
}

function renderBar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <QuickAddBar />
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("QuickAddBar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("confirms a saved entry with a toast and undoes it with a DELETE", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/logs/42") && method === "DELETE") {
        return Promise.resolve({ ok: true, status: 204 } as Response);
      }
      if (url.includes("/logs") && method === "POST") {
        return Promise.resolve(jsonResponse({ ...CREATED, quality_score: 8 }, 201));
      }
      if (url.includes("/models")) return Promise.resolve(jsonResponse(MODELS));
      return Promise.resolve(jsonResponse([]));
    });

    renderBar();

    // The model list arrives from the API, so wait for the option to exist
    // before selecting it.
    await screen.findByRole("option", { name: "GPT-5" });
    await user.selectOptions(screen.getAllByRole("combobox")[0], "1");
    await user.click(screen.getByRole("button", { name: /log it/i }));

    // Toast names the model it was logged against.
    expect(await screen.findByText("Logged GPT-5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /undo/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/logs/42", expect.objectContaining({ method: "DELETE" }));
    });
  });

  it("refuses to save an empty entry", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve(jsonResponse([]))
    );

    renderBar();

    await user.click(screen.getByRole("button", { name: /log it/i }));

    expect(
      await screen.findByText(/pick a model or category, or add a description/i)
    ).toBeInTheDocument();
  });
});