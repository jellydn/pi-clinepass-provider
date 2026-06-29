import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OAuthCredentials } from "@earendil-works/pi-ai";
import { refreshToken, getApiKey } from "../../src/oauth.js";
import { DEFAULT_API_BASE } from "../../src/env.js";
import { CLINE_REFRESH_ENDPOINT } from "../../src/workos.js";

// ─── refreshToken dispatch ──────────────────────────────────────────────────

describe("refreshToken dispatch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
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

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { accessToken: "eyJnew_jwt", refreshToken: "new_rt_123" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await refreshToken(cred);

    // fetch was called (dispatch correctly detected WorkOS via credentials.access)
    expect(fetch).toHaveBeenCalledTimes(1);

    // Correct endpoint and body format
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${DEFAULT_API_BASE}${CLINE_REFRESH_ENDPOINT}`);
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.granttype).toBe("refresh_token"); // no underscore
    expect(body.refreshToken).toBe("fwdkkS0zeAT8JJd8EYEKJ09sf");

    // Result has workos: prefix added
    expect(result.access).toBe("workos:eyJnew_jwt");
    expect(result.refresh).toBe("new_rt_123");
    expect(result.expires).toBeGreaterThan(Date.now());
  });

  it("preserves workos: prefix when refresh endpoint already includes it", async () => {
    const cred: OAuthCredentials = {
      access: "workos:eyJold...",
      refresh: "old_rt",
      expires: Date.now() - 1000,
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            accessToken: "workos:eyJnew_with_prefix",
            refreshToken: "new_rt_with_prefix",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await refreshToken(cred);

    // Should not double-prefix
    expect(result.access).toBe("workos:eyJnew_with_prefix");
    expect(result.refresh).toBe("new_rt_with_prefix");
  });

  it("throws on non-OK response from refresh endpoint", async () => {
    const cred: OAuthCredentials = {
      access: "workos:eyJexpired...",
      refresh: "expired_rt",
      expires: Date.now() - 1000,
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Invalid refresh token", { status: 401 }),
    );

    await expect(refreshToken(cred)).rejects.toThrow(/token refresh failed/i);
  });

  it("throws when response is missing accessToken or refreshToken", async () => {
    const cred: OAuthCredentials = {
      access: "workos:eyJexpired...",
      refresh: "expired_rt",
      expires: Date.now() - 1000,
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(refreshToken(cred)).rejects.toThrow(/unexpected response format/i);
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
