import { describe, it, expect, vi } from "vitest";
import { handleClinePassError } from "../../src/error-handler.js";
import { PROVIDER_NAME } from "../../src/env.js";
import { CLINEPASS_ERROR_MESSAGES } from "../../src/errors.js";

/** Event shape accepted by handleClinePassError. */
type MessageEndEvent = {
  message: { stopReason?: string; errorMessage?: string; provider?: string };
};

/** Context shape accepted by handleClinePassError. */
type HandlerCtx = {
  hasUI: boolean;
  ui: { notify: (msg: string, type: "info" | "warning" | "error") => void };
  model?: { provider?: string };
};

/** Build a standard UI context that captures notify calls. */
function makeUICtx(notifyCalls: { msg: string; type: string }[]): HandlerCtx {
  return {
    hasUI: true,
    ui: { notify: (msg: string, type: string) => notifyCalls.push({ msg, type }) },
    model: { provider: PROVIDER_NAME },
  };
}

// ─── handleClinePassError ───────────────────────────────────────────────────

describe("handleClinePassError", () => {
  it("surfaces friendly message for 403 errors from clinepass", () => {
    const notifyCalls: { msg: string; type: string }[] = [];
    handleClinePassError(
      {
        message: {
          stopReason: "error",
          errorMessage: "Request failed with status 403",
          provider: PROVIDER_NAME,
        },
      } as MessageEndEvent,
      makeUICtx(notifyCalls),
    );

    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].msg).toBe(CLINEPASS_ERROR_MESSAGES.not_subscribed);
    expect(notifyCalls[0].type).toBe("error");
  });

  it("surfaces friendly message for 401 errors", () => {
    const notifyCalls: { msg: string; type: string }[] = [];
    handleClinePassError(
      {
        message: { stopReason: "error", errorMessage: "401 Unauthorized", provider: PROVIDER_NAME },
      } as MessageEndEvent,
      makeUICtx(notifyCalls),
    );

    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].msg).toBe(CLINEPASS_ERROR_MESSAGES.auth_expired);
  });

  it("surfaces friendly message for 429 rate limit errors", () => {
    const notifyCalls: { msg: string; type: string }[] = [];
    handleClinePassError(
      {
        message: {
          stopReason: "error",
          errorMessage: "429 Too Many Requests",
          provider: PROVIDER_NAME,
        },
      } as MessageEndEvent,
      makeUICtx(notifyCalls),
    );

    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].msg).toBe(CLINEPASS_ERROR_MESSAGES.rate_limited);
  });

  it("uses ctx.model.provider when message has no provider field", () => {
    const notifyCalls: { msg: string; type: string }[] = [];
    handleClinePassError(
      {
        message: { stopReason: "error", errorMessage: "403 Forbidden" },
      } as MessageEndEvent,
      makeUICtx(notifyCalls),
    );

    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].msg).toBe(CLINEPASS_ERROR_MESSAGES.not_subscribed);
  });

  it("surfaces friendly message for unknown error types", () => {
    const notifyCalls: { msg: string; type: string }[] = [];
    handleClinePassError(
      {
        message: {
          stopReason: "error",
          errorMessage: "Internal server error",
          provider: PROVIDER_NAME,
        },
      } as MessageEndEvent,
      makeUICtx(notifyCalls),
    );

    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].msg).toBe(CLINEPASS_ERROR_MESSAGES.unknown);
    expect(notifyCalls[0].type).toBe("error");
  });

  it("ignores errors from other providers", () => {
    const notifyCalls: { msg: string; type: string }[] = [];
    handleClinePassError(
      {
        message: { stopReason: "error", errorMessage: "403 Forbidden", provider: "openai" },
      } as MessageEndEvent,
      {
        hasUI: true,
        ui: { notify: (msg: string, type: string) => notifyCalls.push({ msg, type }) },
        model: { provider: "openai" },
      },
    );

    expect(notifyCalls).toHaveLength(0);
  });

  it("ignores non-error messages", () => {
    const notifyCalls: { msg: string; type: string }[] = [];
    handleClinePassError(
      {
        message: { stopReason: "stop", provider: PROVIDER_NAME },
      } as MessageEndEvent,
      makeUICtx(notifyCalls),
    );

    expect(notifyCalls).toHaveLength(0);
  });

  it("falls back to console.error when no UI", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    handleClinePassError(
      {
        message: {
          stopReason: "error",
          errorMessage: "403 Forbidden",
          provider: PROVIDER_NAME,
        },
      } as MessageEndEvent,
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
