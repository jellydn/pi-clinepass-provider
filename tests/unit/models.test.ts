import { describe, it, expect } from "vitest";
import { modelIds, MODELS, CLINEPASS_OPENAI_COMPAT } from "../../src/models.js";

// ─── modelIds / MODELS ──────────────────────────────────────────────────────

describe("modelIds", () => {
  it("returns all model IDs", () => {
    const ids = modelIds();
    expect(ids).toHaveLength(MODELS.length);
    expect(ids).toContain("cline-pass/glm-5.3");
    expect(ids).toContain("cline-pass/glm-5.3-flash");
    expect(ids).toContain("cline-pass/kimi-k3");
    expect(ids).toContain("cline-pass/kimi-k3.1-pro");
    expect(ids).toContain("cline-pass/muse-spark-1.3-contributor");
    expect(ids).toContain("cline-pass/deepseek-v4.1-flash");
    expect(ids).toContain("cline-pass/deepseek-v4.1-flash-1017");
    expect(ids).toContain("cline-pass/mimo-v2.6-flash");
    expect(ids).toContain("cline-pass/mimo-v2.6-pro");
    expect(ids).toContain("cline-pass/minimax-m3.1-flash");
    // Models deprecated by Cline effective 2026-09-21 (issue #79).
    expect(ids).not.toContain("cline-pass/glm-5.2");
    expect(ids).not.toContain("cline-pass/kimi-k2.7-code");
    expect(ids).not.toContain("cline-pass/kimi-k2.6");
    expect(ids).not.toContain("cline-pass/deepseek-v4-flash");
    // MiMo V2.5 pair removed from ClinePass in the 2026-11 lineup refresh.
    expect(ids).not.toContain("cline-pass/mimo-v2.5");
    expect(ids).not.toContain("cline-pass/mimo-v2.5-pro");
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

  it("MiMo V2.6 Flash exposes a 1M context window", () => {
    const model = MODELS.find((m) => m.id === "cline-pass/mimo-v2.6-flash")!;
    expect(model.contextWindow).toBe(1_048_576);
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
      expect(m.input[0]).toBe("text");
    }
  });

  it("declares input as exactly text-only or text+image, no exceptions", () => {
    for (const m of MODELS) {
      const textOnly = m.input.length === 1 && m.input[0] === "text";
      const textAndImage = m.input.length === 2 && m.input[0] === "text" && m.input[1] === "image";
      expect(textOnly || textAndImage).toBe(true);
    }
  });

  it("enables image input for the twelve multimodal models", () => {
    // Per OpenRouter architecture.input_modalities and live gateway probes
    // (2026-11-02): all five new models accept image_url content. The
    // remaining models are text-only.
    const imageModels = [
      "cline-pass/kimi-k3",
      "cline-pass/kimi-k3.1-pro",
      "cline-pass/glm-5.3-flash",
      "cline-pass/mimo-v2.6-flash",
      "cline-pass/mimo-v2.6-pro",
      "cline-pass/minimax-m3",
      "cline-pass/minimax-m3.1-flash",
      "cline-pass/muse-spark-1.3-contributor",
      "cline-pass/qwen3.8-max",
      "cline-pass/qwen3.7-plus",
      "cline-pass/deepseek-v4.1-flash",
      "cline-pass/deepseek-v4.1-flash-1017",
    ];
    for (const id of imageModels) {
      expect(MODELS.find((m) => m.id === id)!.input).toEqual(["text", "image"]);
    }
  });

  it("keeps text-only input for the three non-multimodal models", () => {
    const textModels = [
      "cline-pass/glm-5.3",
      "cline-pass/deepseek-v4-pro",
      "cline-pass/qwen3.7-max",
    ];
    for (const id of textModels) {
      expect(MODELS.find((m) => m.id === id)!.input).toEqual(["text"]);
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
      "cline-pass/mimo-v2.6-flash",
      "cline-pass/mimo-v2.6-pro",
      "cline-pass/minimax-m3",
      "cline-pass/minimax-m3.1-flash",
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
      cacheRead: 0.17,
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

  it("Kimi K3.1 Pro supports every effort tier except minimal", () => {
    // Verified live against the ClinePass gateway (2026-11-02):
    // reasoning_effort none/low/medium/high/max all return 200 with
    // content, so pi's off/low/medium/high map directly and xhigh maps to
    // the extra "max" tier. Pricing per the ClinePass docs table (peak).
    const model = MODELS.find((m) => m.id === "cline-pass/kimi-k3.1-pro")!;
    expect(model.thinkingLevelMap).toEqual({
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "max",
    });
    expect(model.cost).toEqual({
      input: 2,
      output: 10,
      cacheRead: 0.2,
      cacheWrite: 2,
    });
    expect(model.contextWindow).toBe(1_048_576);
    expect(model.maxTokens).toBe(131_072);
    expect(model.input).toEqual(["text", "image"]);
  });

  it("DeepSeek V4 models only support high (and xhigh clamped to high)", () => {
    for (const id of [
      "cline-pass/deepseek-v4-pro",
      "cline-pass/deepseek-v4.1-flash",
      "cline-pass/deepseek-v4.1-flash-1017",
    ]) {
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

  it("pins DeepSeek V4 Pro to the ClinePass peak reference rates", () => {
    const model = MODELS.find((m) => m.id === "cline-pass/deepseek-v4-pro")!;
    expect(model.cost).toEqual({ input: 1.32, output: 3.96, cacheRead: 0.044, cacheWrite: 0 });
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
