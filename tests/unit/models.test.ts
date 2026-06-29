import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { modelIds, MODELS, fetchRemoteModels, resolveModels } from "../../src/models.js";

// ─── modelIds / MODELS ──────────────────────────────────────────────────────

describe("modelIds", () => {
  it("returns all model IDs", () => {
    const ids = modelIds();
    expect(ids).toHaveLength(MODELS.length);
    expect(ids).toContain("cline-pass/glm-5.2");
    expect(ids).toContain("cline-pass/kimi-k2.7-code");
    expect(ids).toContain("cline-pass/deepseek-v4-flash");
  });

  it("all IDs start with cline-pass/", () => {
    for (const id of modelIds()) {
      expect(id.startsWith("cline-pass/")).toBe(true);
    }
  });
});

describe("MODELS", () => {
  it("has at least one model", () => {
    expect(MODELS.length).toBeGreaterThan(0);
  });

  it("all models have valid cost and context fields", () => {
    for (const m of MODELS) {
      expect(m.cost.input).toBeGreaterThanOrEqual(0);
      expect(m.cost.output).toBeGreaterThanOrEqual(0);
      expect(m.cost.cacheRead).toBeGreaterThanOrEqual(0);
      expect(m.cost.cacheWrite).toBeGreaterThanOrEqual(0);
      expect(m.contextWindow).toBeGreaterThan(0);
      expect(m.maxTokens).toBeGreaterThan(0);
      expect(m.reasoning).toBe(true);
      expect(m.input).toEqual(["text"]);
    }
  });
});

// ─── fetchRemoteModels ─────────────────────────────────────────────────────

describe("fetchRemoteModels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns undefined when no API key is provided", async () => {
    const result = await fetchRemoteModels({ apiKey: undefined });
    expect(result).toBeUndefined();
  });

  it("returns undefined on non-OK response (e.g. 404)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toBeUndefined();
  });

  it("returns undefined on network error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toBeUndefined();
  });

  it("parses OpenAI-compatible { data: [...] } response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "cline-pass/glm-5.2",
              name: "GLM-5.2",
              context_length: 200_000,
              max_output_tokens: 131_072,
              pricing: { prompt: "0.0000014", completion: "0.0000044", cached_input: "0.00000026" },
              reasoning: true,
            },
            {
              id: "cline-pass/deepseek-v4-flash",
              name: "DeepSeek V4 Flash",
              context_length: 1_000_000,
              max_output_tokens: 384_000,
              reasoning: true,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(2);
    expect(result![0].id).toBe("cline-pass/glm-5.2");
    expect(result![0].name).toBe("GLM-5.2");
    expect(result![0].contextWindow).toBe(200_000);
    expect(result![0].maxTokens).toBe(131_072);
    expect(result![0].reasoning).toBe(true);
    expect(result![0].cost.input).toBeCloseTo(1.4, 1);
    expect(result![0].cost.output).toBeCloseTo(4.4, 1);
  });

  it("parses bare array response format", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify([{ id: "cline-pass/kimi-k2.7-code", name: "Kimi K2.7 Code" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("cline-pass/kimi-k2.7-code");
  });

  it("filters out non-cline-pass models", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "cline-pass/glm-5.2", name: "GLM-5.2" },
            { id: "openai/gpt-5", name: "GPT-5" },
            { id: "anthropic/claude-4", name: "Claude 4" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("cline-pass/glm-5.2");
  });

  it("uses static model fallback values for missing fields", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "cline-pass/glm-5.2" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(1);
    const staticModel = MODELS.find((m) => m.id === "cline-pass/glm-5.2");
    expect(result![0].contextWindow).toBe(staticModel!.contextWindow);
    expect(result![0].maxTokens).toBe(staticModel!.maxTokens);
    expect(result![0].cost.input).toBe(staticModel!.cost.input);
  });

  it("returns undefined for empty model list", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toBeUndefined();
  });
});

// ─── resolveModels ─────────────────────────────────────────────────────────

describe("resolveModels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to static MODELS when no API key", async () => {
    const result = await resolveModels(undefined);
    expect(result).toEqual(MODELS);
  });

  it("falls back to static MODELS when fetch fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );
    const result = await resolveModels("test_key");
    expect(result).toEqual(MODELS);
  });

  it("returns remote models when fetch succeeds", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "cline-pass/glm-5.2", name: "GLM-5.2 Updated" },
            { id: "cline-pass/new-model", name: "New Model" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await resolveModels("test_key");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("cline-pass/glm-5.2");
    expect(result[0].name).toBe("GLM-5.2 Updated");
    expect(result[1].id).toBe("cline-pass/new-model");
  });
});
