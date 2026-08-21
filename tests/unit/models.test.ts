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
    expect(ids).toContain("cline-pass/glm-5.2");
    expect(ids).toContain("cline-pass/kimi-k2.7-code");
    expect(ids).toContain("cline-pass/kimi-k3");
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

  it("Kimi K2 models always reason but support standard efforts", () => {
    const kimiK2Models = ["cline-pass/kimi-k2.7-code", "cline-pass/kimi-k2.6"];
    for (const id of kimiK2Models) {
      const model = MODELS.find((m) => m.id === id)!;
      const map = model.thinkingLevelMap;
      expect(map.off).toBeNull();
      expect(map.minimal).toBeNull();
      expect(map.xhigh).toBeNull();
      expect(map.low).toBe("low");
      expect(map.medium).toBe("medium");
      expect(map.high).toBe("high");
    }
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
    for (const id of ["cline-pass/deepseek-v4-pro", "cline-pass/deepseek-v4-flash"]) {
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

  it("GLM-5.2 supports low/medium/high/xhigh (minimal unsupported)", () => {
    const model = MODELS.find((m) => m.id === "cline-pass/glm-5.2")!;
    const map = model.thinkingLevelMap;
    expect(map.off).toBe("none");
    expect(map.minimal).toBeNull();
    expect(map.low).toBe("low");
    expect(map.medium).toBe("medium");
    expect(map.high).toBe("high");
    expect(map.xhigh).toBe("xhigh");
  });

  it("maps pi off to none for GLM-5.2 (issue #17)", () => {
    const glm = MODELS.find((m) => m.id === "cline-pass/glm-5.2")!;
    expect(glm.thinkingLevelMap.off).toBe("none");
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
    expect(result![0].thinkingLevelMap.off).toBe("none");
    expect(result![0].cost.input).toBeCloseTo(1.4, 1);
    expect(result![0].cost.output).toBeCloseTo(4.4, 1);
    expect(result![0].compat.supportsDeveloperRole).toBe(false);
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
    expect(result[1].thinkingLevelMap.off).toBe("none");
  });
});
