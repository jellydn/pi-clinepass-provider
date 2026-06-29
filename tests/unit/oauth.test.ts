import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OAuthCredentials } from "@earendil-works/pi-ai";
import { refreshToken, getApiKey } from "../../src/oauth.js";

// ─── refreshToken dispatch ──────────────────────────────────────────────────
//
// Tests that refreshToken correctly dispatches between static API keys
// (no-op) and WorkOS OAuth tokens (delegates to refreshWorkosToken).
// The detailed protocol tests (endpoint URL, body format, prefix handling,
// error cases) are in workos.test.ts.

describe("refreshToken dispatch", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { accessToken: "workos:eyJnew", refreshToken: "new_rt" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns static credentials without calling fetch for static API keys", async () => {
    const cred: OAuthCredentials = {
      access: "cline_static_key_abc123",
      refresh: "cline_static_key_abc123",
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    };

    const result = await refreshToken(cred);

    expect(result.access).toBe("cline_static_key_abc123");
    expect(result.refresh).toBe("cline_static_key_abc123");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls fetch for WorkOS OAuth tokens (checks credentials.access not .refresh)", async () => {
    const cred: OAuthCredentials = {
      access: "workos:eyJhbGciOiJSUzI1NiIs...",
      refresh: "fwdkkS0zeAT8JJd8EYEKJ09sf", // no workos: prefix
      expires: Date.now() - 1000, // expired
    };

    const result = await refreshToken(cred);

    // fetch was called (dispatch correctly detected WorkOS via credentials.access)
    expect(fetch).toHaveBeenCalledTimes(1);

    // Result has workos: prefix added
    expect(result.access).toBe("workos:eyJnew");
    expect(result.refresh).toBe("new_rt");
    expect(result.expires).toBeGreaterThan(Date.now());
  });
});

// ─── getApiKey ──────────────────────────────────────────────────────────────

describe("getApiKey", () => {
  it("returns the access token from credentials", () => {
    const cred: OAuthCredentials = {
      access: "workos:eyJ...",
      refresh: "rt_abc",
      expires: Date.now() + 3600000,
    };
    expect(getApiKey(cred)).toBe("workos:eyJ...");
  });

  it("returns static API key from credentials", () => {
    const cred: OAuthCredentials = {
      access: "cline_static_key",
      refresh: "cline_static_key",
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    };
    expect(getApiKey(cred)).toBe("cline_static_key");
  });
});
