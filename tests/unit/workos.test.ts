import { describe, it, expect, vi } from "vitest";
import type { OAuthCredentials } from "@earendil-works/pi-ai";
import {
  resolveClineAuthCredentials,
  isWorkosToken,
  refreshWorkosToken,
  WORKOS_TOKEN_PREFIX,
  CLINE_REFRESH_ENDPOINT,
  WORKOS_TOKEN_LIFETIME_MS,
} from "../../src/workos.js";
import { DEFAULT_API_BASE } from "../../src/env.js";

// ─── isWorkosToken ──────────────────────────────────────────────────────────

describe("isWorkosToken", () => {
  it("returns true for tokens with workos: prefix", () => {
    expect(isWorkosToken("workos:eyJhbGciOiJSUzI1NiIs...")).toBe(true);
  });

  it("returns false for static API keys", () => {
    expect(isWorkosToken("cline_abc123")).toBe(false);
  });

  it("returns false for empty strings", () => {
    expect(isWorkosToken("")).toBe(false);
  });

  it("returns false for bare JWTs without workos: prefix", () => {
    expect(isWorkosToken("eyJhbGciOiJSUzI1NiIs...")).toBe(false);
  });
});

// ─── WorkOS constants ───────────────────────────────────────────────────────

describe("WorkOS constants", () => {
  it("exports the workos: prefix", () => {
    expect(WORKOS_TOKEN_PREFIX).toBe("workos:");
  });

  it("exports the Cline refresh endpoint path", () => {
    expect(CLINE_REFRESH_ENDPOINT).toBe("/api/v1/auth/refresh");
  });

  it("exports a conservative token lifetime (~55 min)", () => {
    expect(WORKOS_TOKEN_LIFETIME_MS).toBe(55 * 60 * 1000);
  });
});

// ─── refreshWorkosToken ─────────────────────────────────────────────────────

/** Build a mock fetch that resolves with the given JSON response body. */
function mockFetchOK(body: unknown): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof globalThis.fetch;
}

describe("refreshWorkosToken", () => {
  it("calls the correct endpoint with granttype + refreshToken in body", async () => {
    const mockFetch = mockFetchOK({
      data: { accessToken: "eyJnew_jwt", refreshToken: "new_rt_123" },
    });
    const cred: OAuthCredentials = {
      access: "workos:eyJold...",
      refresh: "fwdkkS0zeAT8JJd8EYEKJ09sf",
      expires: Date.now() - 1000,
    };

    await refreshWorkosToken(cred, { fetch: mockFetch });

    const [url, opts] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${DEFAULT_API_BASE}${CLINE_REFRESH_ENDPOINT}`);
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.granttype).toBe("refresh_token"); // no underscore
    expect(body.refreshToken).toBe("fwdkkS0zeAT8JJd8EYEKJ09sf");
  });

  it("adds workos: prefix when the API returns a bare JWT", async () => {
    const mockFetch = mockFetchOK({
      data: { accessToken: "eyJnew_jwt", refreshToken: "new_rt_123" },
    });
    const cred: OAuthCredentials = {
      access: "workos:eyJold...",
      refresh: "old_rt",
      expires: Date.now() - 1000,
    };

    const result = await refreshWorkosToken(cred, { fetch: mockFetch });

    expect(result.access).toBe("workos:eyJnew_jwt");
    expect(result.refresh).toBe("new_rt_123");
    expect(result.expires).toBeGreaterThan(Date.now());
  });

  it("preserves workos: prefix when refresh endpoint already includes it", async () => {
    const mockFetch = mockFetchOK({
      data: {
        accessToken: "workos:eyJnew_with_prefix",
        refreshToken: "new_rt_with_prefix",
      },
    });
    const cred: OAuthCredentials = {
      access: "workos:eyJold...",
      refresh: "old_rt",
      expires: Date.now() - 1000,
    };

    const result = await refreshWorkosToken(cred, { fetch: mockFetch });

    // Should not double-prefix
    expect(result.access).toBe("workos:eyJnew_with_prefix");
    expect(result.refresh).toBe("new_rt_with_prefix");
  });

  it("throws on non-OK response from refresh endpoint", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response("Invalid refresh token", { status: 401 }),
      ) as unknown as typeof globalThis.fetch;
    const cred: OAuthCredentials = {
      access: "workos:eyJexpired...",
      refresh: "expired_rt",
      expires: Date.now() - 1000,
    };

    await expect(refreshWorkosToken(cred, { fetch: mockFetch })).rejects.toThrow(
      /token refresh failed/i,
    );
  });

  it("throws when response is missing accessToken or refreshToken", async () => {
    const mockFetch = mockFetchOK({ data: {} });
    const cred: OAuthCredentials = {
      access: "workos:eyJexpired...",
      refresh: "expired_rt",
      expires: Date.now() - 1000,
    };

    await expect(refreshWorkosToken(cred, { fetch: mockFetch })).rejects.toThrow(
      /unexpected response format/i,
    );
  });
});

// ─── resolveClineAuthCredentials ────────────────────────────────────────────

describe("resolveClineAuthCredentials", () => {
  it("extracts WorkOS credentials from cline-pass provider", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": {
            settings: {
              auth: {
                accessToken: "workos:eyJ...",
                refreshToken: "rt_abc123",
                expiresAt: 1782758019000,
              },
            },
          },
        },
      });
    const fileExists = () => true;
    const creds = resolveClineAuthCredentials({ readFile, fileExists });
    expect(creds).toEqual({
      accessToken: "workos:eyJ...",
      refreshToken: "rt_abc123",
      expiresAt: 1782758019000,
    });
  });

  it("extracts WorkOS credentials from cline provider", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          cline: {
            settings: {
              auth: {
                accessToken: "workos:eyJ...",
                refreshToken: "rt_def456",
                expiresAt: 1782758019000,
              },
            },
          },
        },
      });
    const fileExists = () => true;
    const creds = resolveClineAuthCredentials({ readFile, fileExists });
    expect(creds?.accessToken).toBe("workos:eyJ...");
    expect(creds?.refreshToken).toBe("rt_def456");
  });

  it("prefers cline-pass credentials over cline", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": {
            settings: {
              auth: { accessToken: "workos:pass_token", refreshToken: "rt_pass", expiresAt: 1000 },
            },
          },
          cline: {
            settings: {
              auth: {
                accessToken: "workos:cline_token",
                refreshToken: "rt_cline",
                expiresAt: 2000,
              },
            },
          },
        },
      });
    const fileExists = () => true;
    const creds = resolveClineAuthCredentials({ readFile, fileExists });
    expect(creds?.accessToken).toBe("workos:pass_token");
    expect(creds?.refreshToken).toBe("rt_pass");
  });

  it("returns undefined when no auth field exists", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": { settings: { apiKey: "cline_static_key" } },
        },
      });
    const fileExists = () => true;
    expect(resolveClineAuthCredentials({ readFile, fileExists })).toBeUndefined();
  });

  it("returns undefined when accessToken is missing", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": {
            settings: { auth: { refreshToken: "rt_only" } },
          },
        },
      });
    const fileExists = () => true;
    expect(resolveClineAuthCredentials({ readFile, fileExists })).toBeUndefined();
  });

  it("returns undefined when refreshToken is missing", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": {
            settings: { auth: { accessToken: "workos:at_only" } },
          },
        },
      });
    const fileExists = () => true;
    expect(resolveClineAuthCredentials({ readFile, fileExists })).toBeUndefined();
  });

  it("defaults expiresAt when not a number", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": {
            settings: {
              auth: {
                accessToken: "workos:eyJ...",
                refreshToken: "rt_abc",
                expiresAt: "not_a_number",
              },
            },
          },
        },
      });
    const fileExists = () => true;
    const creds = resolveClineAuthCredentials({ readFile, fileExists });
    expect(creds?.accessToken).toBe("workos:eyJ...");
    expect(creds?.refreshToken).toBe("rt_abc");
    expect(creds?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("returns undefined when no providers.json exists", () => {
    const fileExists = () => false;
    expect(resolveClineAuthCredentials({ fileExists })).toBeUndefined();
  });

  it("returns undefined for malformed JSON", () => {
    const readFile = () => "not json";
    const fileExists = () => true;
    expect(resolveClineAuthCredentials({ readFile, fileExists })).toBeUndefined();
  });
});
