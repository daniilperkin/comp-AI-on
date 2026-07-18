import { describe, it, expect, vi } from "vitest";
import { api } from "@/lib/api";

describe("api client", () => {
  it("makes GET requests to /api path", async () => {
    const mockResponse = { ok: true, status: 200, json: async () => ({ id: 1 }) } as Response;
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockResponse);

    const result = await api.get("/models");
    expect(fetchSpy).toHaveBeenCalledWith("/api/models", expect.objectContaining({ headers: { "Content-Type": "application/json" } }));
    expect(result).toEqual({ id: 1 });

    fetchSpy.mockRestore();
  });

  it("makes POST requests with JSON body", async () => {
    const mockResponse = { ok: true, status: 201, json: async () => ({ id: 1 }) } as Response;
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockResponse);

    await api.post("/logs", { quality_score: 8 });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/logs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ quality_score: 8 }),
      })
    );

    fetchSpy.mockRestore();
  });

  it("returns undefined for 204 No Content", async () => {
    const mockResponse = { ok: true, status: 204 } as Response;
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockResponse);

    const result = await api.delete("/logs/1");
    expect(result).toBeUndefined();

    fetchSpy.mockRestore();
  });

  it("throws on non-2xx responses", async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "Log entry not found" }),
    } as unknown as Response;
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockResponse);

    await expect(api.get("/logs/999")).rejects.toThrow("Log entry not found");

    fetchSpy.mockRestore();
  });

  it("falls back to statusText when no detail", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => { throw new Error("not JSON"); },
    } as unknown as Response;
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockResponse);

    await expect(api.get("/models")).rejects.toThrow("Internal Server Error");

    fetchSpy.mockRestore();
  });
});
