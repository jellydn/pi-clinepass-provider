import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  modelIds,
  MODELS,
  CLINEPASS_OPENAI_COMPAT,
  DEFAULT_THINKING_LEVEL_MAP,
  fetchRemoteModels,
  resolveModels,
  NO_THINKING_MAP,
} from "../../src/models.js";

// ─── modelIds / MODELS ──────────────────────────────────────────────────────

describe("modelIds", () => {
  it("returns all model IDs", () => {
    const ids = modelIds();
    expect(ids).toHaveLength(MODELS.length);
    expect(ids).toContain("cline-pass/glm-5.3");
    expect(ids).toContain("cline-pass/glm-5.3-flash");
    expect(ids).toContain("cline-pass/kimi-k3");
    expect(ids).toContain("cline-pass/muse-spark-1.3-contributor");
    expect(ids).toContain("cline-pass/deepseek-v4.1-flash");
    // Models deprecated by Cline effective 2026-09-21 (issue #79).
    expect(ids).not.toContain("cline-pass/glm-5.2");
    expect(ids).not.toContain("cline-pass/kimi-k2.7-code");
    expect(ids).not.toContain("cline-pass/kimi-k2.6");
    expect(ids).not.toContain("cline-pass/deepseek-v4-flash");
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

  it("every model declares all six thinking levels", () => {
    const validLevels = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
    for (const m of MODELS) {
      const map = m.thinkingLevelMap;
      for (const level of validLevels) {
        expect(map).toHaveProperty(level);
        const value = map[level];
        expect(value === null || typeof value === "string").toBe(true);
      }
    }
  });

  it("DEFAULT_THINKING_LEVEL_MAP maps pi off to Cline none", () => {
    expect(DEFAULT_THINKING_LEVEL_MAP.off).toBe("none");
  });

  it("models that support disabling reasoning map pi off to Cline none", () => {
    for (const model of MODELS) {
      if (model.thinkingLevelMap.off === null) continue;
      expect(model.thinkingLevelMap.off).toBe("none");
    }
  });

  it("models without an upstream xhigh tier restrict minimal and xhigh to null", () => {
    // The Cline client exposes reasoning effort levels (including "off", which
    // maps to "none" for ClinePass). Models whose upstream provider has no
    // extra-high tier (e.g. z.ai "max") must map both minimal and xhigh to null.
    const withoutXhigh = [
      "cline-pass/mimo-v2.5",
      "cline-pass/mimo-v2.5-pro",
      "cline-pass/minimax-m3",
      "cline-pass/qwen3.7-max",
      "cline-pass/qwen3.7-plus",
    ];
    for (const id of withoutXhigh) {
      const model = MODELS.find((m) => m.id === id)!;
      const map = model.thinkingLevelMap;
      expect(map.minimal).toBeNull();
      expect(map.xhigh).toBeNull();
      // low/medium/high are supported and send the standard Cline effort values.
      expect(map.low).toBe("low");
      expect(map.medium).toBe("medium");
      expect(map.high).toBe("high");
      // "off" is represented as "none" for the ClinePass API.
      expect(map.off).toBe("none");
    }
  });

  it("Qwen3.8 Max offers low/medium/xhigh only", () => {
    // qwen3.8-max exposes three native reasoning_effort tiers — low, medium,
    // xhigh (its default) — and no tier between medium and xhigh. "high" is
    // therefore left unsupported (null) rather than aliased to xhigh, so every
    // offered thinking level produces a distinct result; "minimal" is null for
    // the same reason (no tier below low).
    //
    // "off" is null because thinking cannot be disabled through this path:
    // the model only honours `enable_thinking: false`, which pi's
    // openai-completions format never sends, so reasoning_effort="none" is
    // ignored and the model keeps thinking. Offering "off" would be a no-op
    // that misreports the model's state (same reasoning as Kimi K3).
    const model = MODELS.find((m) => m.id === "cline-pass/qwen3.8-max")!;
    const map = model.thinkingLevelMap;
    expect(map.off).toBeNull();
    expect(map.minimal).toBeNull();
    expect(map.low).toBe("low");
    expect(map.medium).toBe("medium");
    expect(map.high).toBeNull();
    expect(map.xhigh).toBe("xhigh");
    expect(model.cost).toEqual({
      input: 2,
      output: 6,
      cacheRead: 0.25,
      cacheWrite: 2.5,
    });
    expect(model.contextWindow).toBe(1_000_000);
    expect(model.maxTokens).toBe(131_072);
  });

  it("Muse Spark 1.3 Contributor maps pi levels 1:1 (thinking always on)", () => {
    // Muse Spark always reasons: reasoning_effort="none" returns HTTP 400,
    // so "off" is unsupported. Meta's effort enum is minimal/low/medium/
    // high/xhigh and pi's levels map 1:1. The upstream "max" tier is
    // standard-tier only (not available on Contributor models), so pi's
    // "xhigh" maps to "xhigh" rather than "max".
    const model = MODELS.find((m) => m.id === "cline-pass/muse-spark-1.3-contributor")!;
    const map = model.thinkingLevelMap;
    expect(map.off).toBeNull();
    expect(map.minimal).toBe("minimal");
    expect(map.low).toBe("low");
    expect(map.medium).toBe("medium");
    expect(map.high).toBe("high");
    expect(map.xhigh).toBe("xhigh");
    // Contributor-tier pricing per Meta Model API launch materials.
    expect(model.cost).toEqual({
      input: 0.1,
      output: 0.2,
      cacheRead: 0.002,
      cacheWrite: 0,
    });
    expect(model.contextWindow).toBe(1_048_576);
    expect(model.maxTokens).toBe(943_718);
    expect(model.reasoning).toBe(true);
  });

  it("Kimi K3 always reasons with max effort only", () => {
    const model = MODELS.find((m) => m.id === "cline-pass/kimi-k3")!;
    expect(model.thinkingLevelMap).toEqual({
      off: null,
      minimal: null,
      low: null,
      medium: null,
      high: "max",
      xhigh: null,
    });
  });

  it("DeepSeek V4 models only support high (and xhigh clamped to high)", () => {
    for (const id of ["cline-pass/deepseek-v4-pro", "cline-pass/deepseek-v4.1-flash"]) {
      const model = MODELS.find((m) => m.id === id)!;
      const map = model.thinkingLevelMap;
      expect(map.off).toBe("none");
      expect(map.minimal).toBeNull();
      expect(map.low).toBeNull();
      expect(map.medium).toBeNull();
      expect(map.high).toBe("high");
      expect(map.xhigh).toBe("high");
    }
  });

  it("GLM-5.3-Flash supports low/high/max only (thinking always on)", () => {
    // GLM-5.3-Flash (Z.ai) is natively multimodal with text parameters
    // consistent with GLM-5.3: reasoning_effort enum low/high/max and
    // thinking cannot be disabled. Same map and context/output limits as
    // GLM-5.3, but much cheaper per Z.ai's published pricing.
    const model = MODELS.find((m) => m.id === "cline-pass/glm-5.3-flash")!;
    const map = model.thinkingLevelMap;
    expect(map.off).toBeNull();
    expect(map.minimal).toBeNull();
    expect(map.low).toBe("low");
    expect(map.medium).toBeNull();
    expect(map.high).toBe("high");
    expect(map.xhigh).toBe("max");
    expect(model.cost).toEqual({
      input: 0.15,
      output: 0.5,
      cacheRead: 0.03,
      cacheWrite: 0,
    });
    expect(model.contextWindow).toBe(1_048_576);
    expect(model.maxTokens).toBe(131_072);
    expect(model.reasoning).toBe(true);
  });

  it("GLM-5.3 supports low/high/max only (thinking always on)", () => {
    // GLM-5.3 (Z.ai) always reasons and cannot be disabled; its
    // reasoning_effort enum is low/high/max (default max) with no "medium"
    // or "xhigh" tier. "off"/"minimal"/"medium" are null (no corresponding
    // tier, and thinking can't be turned off); pi's "xhigh" maps to "max",
    // the extra-high tier, so every offered level is distinct and
    // increasing. Pricing/context mirror GLM-5.2 per the ClinePass docs.
    const model = MODELS.find((m) => m.id === "cline-pass/glm-5.3")!;
    const map = model.thinkingLevelMap;
    expect(map.off).toBeNull();
    expect(map.minimal).toBeNull();
    expect(map.low).toBe("low");
    expect(map.medium).toBeNull();
    expect(map.high).toBe("high");
    expect(map.xhigh).toBe("max");
    expect(model.cost).toEqual({
      input: 1.4,
      output: 4.4,
      cacheRead: 0.26,
      cacheWrite: 0,
    });
    expect(model.contextWindow).toBe(1_048_576);
    expect(model.maxTokens).toBe(131_072);
    expect(model.reasoning).toBe(true);
  });

  it("pins DeepSeek V4.1 Flash limits and upstream peak reference pricing", () => {
    const model = MODELS.find((m) => m.id === "cline-pass/deepseek-v4.1-flash")!;
    expect(model.contextWindow).toBe(1_000_000);
    expect(model.maxTokens).toBe(384_000);
    expect(model.cost).toEqual({ input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 });
  });

  it("declares supportsDeveloperRole: false for every model (issue #31)", () => {
    for (const model of MODELS) {
      expect(model.compat).toEqual(CLINEPASS_OPENAI_COMPAT);
      expect(model.compat.supportsDeveloperRole).toBe(false);
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
              id: "cline-pass/deepseek-v4.1-flash",
              name: "DeepSeek V4.1 Flash",
              context_length: 200_000,
              max_output_tokens: 131_072,
              pricing: { prompt: "0.0000014", completion: "0.0000044", cached_input: "0.00000026" },
              reasoning: true,
            },
            {
              id: "cline-pass/muse-spark-1.3-contributor",
              name: "Muse Spark 1.3 Contributor",
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
    expect(result![0].id).toBe("cline-pass/deepseek-v4.1-flash");
    expect(result![0].name).toBe("DeepSeek V4.1 Flash");
    expect(result![0].contextWindow).toBe(200_000);
    expect(result![0].maxTokens).toBe(131_072);
    expect(result![0].reasoning).toBe(true);
    expect(result![0].thinkingLevelMap.off).toBe("none");
    expect(result![0].cost.input).toBeCloseTo(1.4, 1);
    expect(result![0].cost.output).toBeCloseTo(4.4, 1);
    expect(result![0].compat.supportsDeveloperRole).toBe(false);
  });

  it("parses bare array response format", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "cline-pass/muse-spark-1.3-contributor", name: "Muse Spark 1.3 Contributor" },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("cline-pass/muse-spark-1.3-contributor");
  });

  it("filters out non-cline-pass models", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "cline-pass/glm-5.3", name: "GLM-5.3" },
            { id: "openai/gpt-5", name: "GPT-5" },
            { id: "anthropic/claude-4", name: "Claude 4" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("cline-pass/glm-5.3");
  });

  it("filters retired IDs without excluding future ClinePass models", async () => {
    const ids = [
      "cline-pass/glm-5.2",
      "cline-pass/kimi-k2.7-code",
      "cline-pass/kimi-k2.6",
      "cline-pass/deepseek-v4-flash",
      "cline-pass/deepseek-v4.1-flash",
      "cline-pass/future-model",
    ];
    const result = await fetchRemoteModels({
      apiKey: "test_key",
      fetch: async () => new Response(JSON.stringify({ data: ids.map((id) => ({ id })) })),
    });
    expect(result?.map((model) => model.id)).toEqual([
      "cline-pass/deepseek-v4.1-flash",
      "cline-pass/future-model",
    ]);
  });

  it("preserves new model thinking maps when remote pricing overrides static rates", async () => {
    const ids = [
      "cline-pass/glm-5.3-flash",
      "cline-pass/muse-spark-1.3-contributor",
      "cline-pass/deepseek-v4.1-flash",
    ];
    const result = await fetchRemoteModels({
      apiKey: "test_key",
      fetch: async () =>
        new Response(
          JSON.stringify({
            data: ids.map((id) => ({
              id,
              pricing: { prompt: "0.000002", completion: "0.000007", cached_input: "0.0000005" },
            })),
          }),
        ),
    });
    expect(result).toHaveLength(3);
    expect(result?.map((model) => model.thinkingLevelMap)).toEqual([
      { off: null, minimal: null, low: "low", medium: null, high: "high", xhigh: "max" },
      { off: null, minimal: "minimal", low: "low", medium: "medium", high: "high", xhigh: "xhigh" },
      { off: "none", minimal: null, low: null, medium: null, high: "high", xhigh: "high" },
    ]);
    for (const model of result!) {
      expect(model.cost).toEqual({ input: 2, output: 7, cacheRead: 0.5, cacheWrite: 0 });
    }
  });

  it("uses static model fallback values for missing fields", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "cline-pass/glm-5.3" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(1);
    const staticModel = MODELS.find((m) => m.id === "cline-pass/glm-5.3");
    expect(result![0].contextWindow).toBe(staticModel!.contextWindow);
    expect(result![0].maxTokens).toBe(staticModel!.maxTokens);
    expect(result![0].cost.input).toBe(staticModel!.cost.input);
    expect(result![0].compat).toEqual(staticModel!.compat);
  });

  it("uses NO_THINKING_MAP when remote model reports reasoning: false", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "cline-pass/non-reasoning-model", reasoning: false }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(1);
    expect(result![0].reasoning).toBe(false);
    expect(result![0].thinkingLevelMap).toEqual(NO_THINKING_MAP);
  });

  it("uses DEFAULT_THINKING_LEVEL_MAP for remote models without a static fallback", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "cline-pass/new-model", name: "New Model", reasoning: true }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(1);
    expect(result![0].thinkingLevelMap).toEqual(DEFAULT_THINKING_LEVEL_MAP);
    expect(result![0].compat.supportsDeveloperRole).toBe(false);
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

  it("falls back to the static catalog when discovery returns only retired IDs", async () => {
    const result = await resolveModels("test_key", {
      fetch: async () =>
        new Response(
          JSON.stringify({
            data: [{ id: "cline-pass/glm-5.2" }, { id: "cline-pass/kimi-k2.6" }],
          }),
        ),
    });
    expect(result).toEqual(MODELS);
  });

  it("returns remote models when fetch succeeds", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "cline-pass/glm-5.3", name: "GLM-5.3 Updated" },
            { id: "cline-pass/new-model", name: "New Model" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await resolveModels("test_key");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("cline-pass/glm-5.3");
    expect(result[0].name).toBe("GLM-5.3 Updated");
    expect(result[1].id).toBe("cline-pass/new-model");
    expect(result[1].thinkingLevelMap.off).toBe("none");
  });
});
