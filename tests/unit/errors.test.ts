import { describe, it, expect } from "vitest";
import { classifyClinePassError, CLINEPASS_ERROR_MESSAGES } from "../../src/errors.js";

// ─── classifyClinePassError ─────────────────────────────────────────────────

describe("classifyClinePassError", () => {
  it("classifies 403 as not_subscribed", () => {
    const result = classifyClinePassError("Request failed with status 403");
    expect(result.type).toBe("not_subscribed");
    expect(result.message).toBe(CLINEPASS_ERROR_MESSAGES.not_subscribed);
  });

  it("classifies 'forbidden' as not_subscribed", () => {
    const result = classifyClinePassError("Forbidden: access denied");
    expect(result.type).toBe("not_subscribed");
  });

  it("classifies 'subscription required' as not_subscribed", () => {
    const result = classifyClinePassError("Subscription required to use ClinePass");
    expect(result.type).toBe("not_subscribed");
  });

  it("classifies 'not subscribed' as not_subscribed", () => {
    const result = classifyClinePassError("User is not subscribed to ClinePass");
    expect(result.type).toBe("not_subscribed");
  });

  it("classifies 401 as auth_expired", () => {
    const result = classifyClinePassError("Request failed with status 401");
    expect(result.type).toBe("auth_expired");
    expect(result.message).toBe(CLINEPASS_ERROR_MESSAGES.auth_expired);
  });

  it("classifies 'unauthorized' as auth_expired", () => {
    const result = classifyClinePassError("Unauthorized: invalid credentials");
    expect(result.type).toBe("auth_expired");
  });

  it("classifies 'invalid api key' as auth_expired", () => {
    const result = classifyClinePassError("invalid api key provided");
    expect(result.type).toBe("auth_expired");
  });

  it("classifies 429 as rate_limited", () => {
    const result = classifyClinePassError("Request failed with status 429");
    expect(result.type).toBe("rate_limited");
    expect(result.message).toBe(CLINEPASS_ERROR_MESSAGES.rate_limited);
  });

  it("classifies 'rate limit' as rate_limited", () => {
    const result = classifyClinePassError("rate limit exceeded");
    expect(result.type).toBe("rate_limited");
  });

  it("classifies 'too many requests' as rate_limited", () => {
    const result = classifyClinePassError("Too many requests");
    expect(result.type).toBe("rate_limited");
  });

  it("classifies unknown errors as unknown", () => {
    const result = classifyClinePassError("Internal server error");
    expect(result.type).toBe("unknown");
    expect(result.message).toBe(CLINEPASS_ERROR_MESSAGES.unknown);
  });

  it("is case-insensitive", () => {
    const result = classifyClinePassError("FORBIDDEN: Access Denied");
    expect(result.type).toBe("not_subscribed");
  });

  it("handles empty string", () => {
    const result = classifyClinePassError("");
    expect(result.type).toBe("unknown");
  });
});
