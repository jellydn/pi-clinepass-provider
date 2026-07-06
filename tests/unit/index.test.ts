import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_API_BASE, ENV_API_KEY, PROVIDER_NAME } from "../../src/env.js";
import { MODELS } from "../../src/models.js";

/**
 * Verifies the provider registration shape passed to pi.registerProvider.
 * Uses a fake ExtensionAPI that captures the call args so we can assert
 * baseUrl, apiKey sigil, api type, model forwarding, and oauth wiring.
 *
 * The default export is now async (dynamic model discovery), so all tests
 * await the call. fetch is stubbed to return a 404 so the static MODELS
 * fallback is used deterministically.
 */
describe("provider registration", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers with correct baseUrl, apiKey, and api type", async () => {
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
    expect(captured!.config.apiKey).toBe(`$${ENV_API_KEY}`);
    expect(captured!.config.api).toBe("openai-completions");
    expect(captured!.config.authHeader).toBe(true);
  });

  it("registers all static models as fallback when API is unavailable", async () => {
    let captured: { config: Record<string, unknown> } | undefined;

    const fakePi = {
      registerProvider(_name: string, config: Record<string, unknown>) {
        captured = { config };
      },
      on(_event: string, _handler: unknown) {},
    };

    const mod = await import("../../src/index.js");
    await mod.default(fakePi as never);

    const models = captured!.config.models as Array<Record<string, unknown>>;
    // Falls back to static MODELS since fetch returns 404
    expect(models).toHaveLength(MODELS.length);

    for (let i = 0; i < MODELS.length; i++) {
      expect(models[i].id).toBe(MODELS[i].id);
      expect(models[i].name).toBe(MODELS[i].name);
      expect(models[i].reasoning).toBe(MODELS[i].reasoning);
      expect(models[i].cost).toEqual(MODELS[i].cost);
      expect(models[i].contextWindow).toBe(MODELS[i].contextWindow);
      expect(models[i].maxTokens).toBe(MODELS[i].maxTokens);
      expect(models[i].thinkingLevelMap).toEqual(MODELS[i].thinkingLevelMap);
      expect(models[i].input).toEqual([...MODELS[i].input]);
      expect(Array.isArray(models[i].input)).toBe(true);
    }
  });

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
