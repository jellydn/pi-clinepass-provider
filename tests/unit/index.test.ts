import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_API_BASE,
  ENV_API_KEY,
  PROVIDER_NAME,
  MODELS,
  CLINEPASS_ERROR_MESSAGES,
} from "../../src/logic.js";

/** Shared handler type for the message_end event in tests. */
type MessageEndHandler = (
  event: { message: { stopReason?: string; errorMessage?: string; provider?: string } },
  ctx: {
    hasUI: boolean;
    ui: { notify: (msg: string, type: string) => void };
    model?: { provider?: string };
  },
) => void;

/** Minimal fake pi with both registerProvider and on() for handler tests. */
function makeFakePi(handlerRef: { h?: MessageEndHandler }) {
  return {
    registerProvider(_name: string, _config: Record<string, unknown>) {},
    on(event: string, h: MessageEndHandler) {
      if (event === "message_end") handlerRef.h = h;
    },
  };
}

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
 * Verifies the message_end error handler surfaces friendly messages for
 * ClinePass-specific errors (403, 401, 429).
 */
describe("message_end error handler", () => {
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

  it("surfaces friendly message for 403 errors from clinepass", async () => {
    const ref: { h?: MessageEndHandler } = {};
    const notifyCalls: { msg: string; type: string }[] = [];

    const mod = await import("../../src/index.js");
    await mod.default(makeFakePi(ref) as never);

    expect(ref.h).toBeDefined();
    ref.h!(
      {
        message: {
          stopReason: "error",
          errorMessage: "Request failed with status 403",
          provider: PROVIDER_NAME,
        },
      },
      {
        hasUI: true,
        ui: { notify: (msg: string, type: string) => notifyCalls.push({ msg, type }) },
        model: { provider: PROVIDER_NAME },
      },
    );

    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].msg).toBe(CLINEPASS_ERROR_MESSAGES.not_subscribed);
    expect(notifyCalls[0].type).toBe("error");
  });

  it("surfaces friendly message for 401 errors", async () => {
    const ref: { h?: MessageEndHandler } = {};
    const notifyCalls: { msg: string; type: string }[] = [];

    const mod = await import("../../src/index.js");
    await mod.default(makeFakePi(ref) as never);

    ref.h!(
      {
        message: { stopReason: "error", errorMessage: "401 Unauthorized", provider: PROVIDER_NAME },
      },
      {
        hasUI: true,
        ui: { notify: (msg: string, type: string) => notifyCalls.push({ msg, type }) },
        model: { provider: PROVIDER_NAME },
      },
    );

    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].msg).toBe(CLINEPASS_ERROR_MESSAGES.auth_expired);
  });

  it("surfaces friendly message for 429 rate limit errors", async () => {
    const ref: { h?: MessageEndHandler } = {};
    const notifyCalls: { msg: string; type: string }[] = [];

    const mod = await import("../../src/index.js");
    await mod.default(makeFakePi(ref) as never);

    ref.h!(
      {
        message: {
          stopReason: "error",
          errorMessage: "429 Too Many Requests",
          provider: PROVIDER_NAME,
        },
      },
      {
        hasUI: true,
        ui: { notify: (msg: string, type: string) => notifyCalls.push({ msg, type }) },
        model: { provider: PROVIDER_NAME },
      },
    );

    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].msg).toBe(CLINEPASS_ERROR_MESSAGES.rate_limited);
  });

  it("uses ctx.model.provider when message has no provider field", async () => {
    const ref: { h?: MessageEndHandler } = {};
    const notifyCalls: { msg: string; type: string }[] = [];

    const mod = await import("../../src/index.js");
    await mod.default(makeFakePi(ref) as never);

    ref.h!(
      {
        message: { stopReason: "error", errorMessage: "403 Forbidden" },
      },
      {
        hasUI: true,
        ui: { notify: (msg: string, type: string) => notifyCalls.push({ msg, type }) },
        model: { provider: PROVIDER_NAME },
      },
    );

    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].msg).toBe(CLINEPASS_ERROR_MESSAGES.not_subscribed);
  });

  it("ignores errors from other providers", async () => {
    const ref: { h?: MessageEndHandler } = {};
    const notifyCalls: { msg: string; type: string }[] = [];

    const mod = await import("../../src/index.js");
    await mod.default(makeFakePi(ref) as never);

    ref.h!(
      {
        message: { stopReason: "error", errorMessage: "403 Forbidden", provider: "openai" },
      },
      {
        hasUI: true,
        ui: { notify: (msg: string, type: string) => notifyCalls.push({ msg, type }) },
        model: { provider: "openai" },
      },
    );

    expect(notifyCalls).toHaveLength(0);
  });

  it("ignores non-error messages", async () => {
    const ref: { h?: MessageEndHandler } = {};
    const notifyCalls: { msg: string; type: string }[] = [];

    const mod = await import("../../src/index.js");
    await mod.default(makeFakePi(ref) as never);

    ref.h!(
      {
        message: { stopReason: "stop", provider: PROVIDER_NAME },
      },
      {
        hasUI: true,
        ui: { notify: (msg: string, type: string) => notifyCalls.push({ msg, type }) },
        model: { provider: PROVIDER_NAME },
      },
    );

    expect(notifyCalls).toHaveLength(0);
  });

  it("falls back to console.error when no UI", async () => {
    const ref: { h?: MessageEndHandler } = {};
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mod = await import("../../src/index.js");
    await mod.default(makeFakePi(ref) as never);

    ref.h!(
      {
        message: {
          stopReason: "error",
          errorMessage: "403 Forbidden",
          provider: PROVIDER_NAME,
        },
      },
      {
        hasUI: false,
        ui: { notify: () => {} },
        model: { provider: PROVIDER_NAME },
      },
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("[clinepass]");
    expect(errorSpy.mock.calls[0][0]).toContain(CLINEPASS_ERROR_MESSAGES.not_subscribed);
    errorSpy.mockRestore();
  });
});
