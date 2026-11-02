import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_API_BASE, ENV_API_KEY, PROVIDER_NAME } from "../../src/env.js";
import { MODELS } from "../../src/models.js";

/**
 * Verifies the provider registration shape passed to pi.registerProvider.
 * Uses a fake ExtensionAPI that captures the call args so we can assert
 * baseUrl, apiKey sigil, api type, model forwarding, and oauth wiring.
 *
 * The complete curated catalog must be registered without consulting a
 * remote catalog, regardless of credentials or network availability.
 */
describe("provider registration", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 })));
    vi.stubEnv(ENV_API_KEY, "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("registers with correct baseUrl, no apiKey when env unset, and api type", async () => {
    let captured: { name: string; config: Record<string, unknown> } | undefined;

    const fakePi = {
      registerProvider(name: string, config: Record<string, unknown>) {
        captured = { name, config };
      },
      on(_event: string, _handler: unknown) {},
    };

    const mod = await import("../../src/index.js");
    await mod.default(fakePi as never);

    expect(captured).toBeDefined();
    expect(captured!.name).toBe(PROVIDER_NAME);
    expect(captured!.config.baseUrl).toBe(`${DEFAULT_API_BASE}/api/v1`);
    expect(captured!.config.apiKey).toBeUndefined();
    expect(captured!.config.api).toBe("openai-completions");
    expect(captured!.config.authHeader).toBe(true);
  });

  it("registers apiKey config when CLINE_API_KEY env var is set", async () => {
    vi.stubEnv(ENV_API_KEY, "test-key-123");
    let captured: { name: string; config: Record<string, unknown> } | undefined;
    const fakePi = {
      registerProvider(name: string, config: Record<string, unknown>) {
        captured = { name, config };
      },
      on(_event: string, _handler: unknown) {},
    };

    const mod = await import("../../src/index.js");
    await mod.default(fakePi as never);

    expect(captured).toBeDefined();
    expect(captured!.config.apiKey).toBe(`$${ENV_API_KEY}`);
  });

  it.each([
    { key: "", remote: "offline" },
    { key: "test-key", remote: "offline" },
    { key: "test-key", remote: "vendor" },
    { key: "test-key", remote: "pass" },
  ])(
    "registers only curated metadata with key '$key' and $remote data",
    async ({ key, remote }) => {
      vi.stubEnv(ENV_API_KEY, key);
      vi.stubGlobal(
        "fetch",
        remote === "offline"
          ? vi.fn().mockRejectedValue(new Error("offline"))
          : vi.fn().mockResolvedValue(
              new Response(
                JSON.stringify({
                  data: [
                    {
                      id: remote === "vendor" ? "other/glm-5.3" : "cline-pass/glm-5.3",
                      context_length: null,
                      max_output_tokens: null,
                      pricing: { prompt: null, completion: "0" },
                      reasoning: false,
                      architecture: { input_modalities: ["text", "image"] },
                    },
                    {
                      id:
                        remote === "vendor"
                          ? "other/unreviewed-model"
                          : "cline-pass/unreviewed-model",
                    },
                  ],
                }),
              ),
            ),
      );
      let captured: { config: Record<string, unknown> } | undefined;

      const fakePi = {
        registerProvider(_name: string, config: Record<string, unknown>) {
          captured = { config };
        },
        on(_event: string, _handler: unknown) {},
      };

      const mod = await import("../../src/index.js");
      await mod.default(fakePi as never);

      expect(fetch).not.toHaveBeenCalled();
      const models = captured!.config.models as Array<Record<string, unknown>>;
      expect(models).toHaveLength(MODELS.length);

      for (let i = 0; i < MODELS.length; i++) {
        expect(models[i].id).toBe(MODELS[i].id);
        expect(models[i].name).toBe(MODELS[i].name);
        expect(models[i].reasoning).toBe(MODELS[i].reasoning);
        expect(models[i].cost).toEqual(MODELS[i].cost);
        expect(models[i].contextWindow).toBe(MODELS[i].contextWindow);
        expect(models[i].maxTokens).toBe(MODELS[i].maxTokens);
        expect(models[i].thinkingLevelMap).toEqual(MODELS[i].thinkingLevelMap);
        expect(models[i].compat).toEqual(MODELS[i].compat);
        expect(models[i].input).toEqual([...MODELS[i].input]);
        expect(Array.isArray(models[i].input)).toBe(true);
      }
      expect(models.find((model) => model.id === "cline-pass/glm-5.3")).toMatchObject({
        input: ["text"],
        contextWindow: 1_048_576,
        maxTokens: 131_072,
        reasoning: true,
        cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
        thinkingLevelMap: {
          off: null,
          minimal: null,
          low: "low",
          medium: null,
          high: "high",
          xhigh: "max",
        },
        compat: { supportsDeveloperRole: false },
      });
      expect(models.some((model) => model.id === "cline-pass/unreviewed-model")).toBe(false);
    },
  );

  it("wires oauth with login, refreshToken, and getApiKey", async () => {
    let captured: { config: Record<string, unknown> } | undefined;

    const fakePi = {
      registerProvider(_name: string, config: Record<string, unknown>) {
        captured = { config };
      },
      on(_event: string, _handler: unknown) {},
    };

    const mod = await import("../../src/index.js");
    await mod.default(fakePi as never);

    const oauth = captured!.config.oauth as Record<string, unknown>;
    expect(oauth.name).toBe("ClinePass");
    expect(typeof oauth.login).toBe("function");
    expect(typeof oauth.refreshToken).toBe("function");
    expect(typeof oauth.getApiKey).toBe("function");
  });
});

/**
 * Verifies that the extension registers a message_end event listener.
 * The handler logic itself is tested in error-handler.test.ts.
 */
describe("message_end event registration", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers a message_end event listener", async () => {
    const registeredEvents: string[] = [];

    const fakePi = {
      registerProvider(_name: string, _config: Record<string, unknown>) {},
      on(event: string, _handler: unknown) {
        registeredEvents.push(event);
      },
    };

    const mod = await import("../../src/index.js");
    await mod.default(fakePi as never);

    expect(registeredEvents).toContain("message_end");
  });
});
