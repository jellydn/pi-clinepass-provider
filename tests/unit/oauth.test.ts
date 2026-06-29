import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import { login, refreshToken, getApiKey } from "../../src/oauth.js";

// ─── Mock WorkOS module for login tests ─────────────────────────────────────
//
// We mock resolveClineAuthCredentials and refreshWorkosToken to control the
// WorkOS auto-login path. All other exports (isWorkosToken, credentialsFromWorkos,
// constants) come from the real module.

const { mockResolveClineAuthCredentials, mockRefreshWorkosToken } = vi.hoisted(() => ({
  mockResolveClineAuthCredentials: vi.fn(),
  mockRefreshWorkosToken: vi.fn(),
}));

vi.mock("../../src/workos.js", async () => ({
  ...(await vi.importActual<typeof import("../../src/workos.js")>("../../src/workos.js")),
  resolveClineAuthCredentials: mockResolveClineAuthCredentials,
  refreshWorkosToken: mockRefreshWorkosToken,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build fake OAuthLoginCallbacks that capture onAuth and control onPrompt. */
function makeCallbacks(overrides?: {
  onAuth?: (params: { url: string }) => void;
  onPrompt?: (params: { message: string }) => string;
}): OAuthLoginCallbacks {
  return {
    onAuth: overrides?.onAuth ?? vi.fn(),
    onPrompt: overrides?.onPrompt ?? vi.fn(),
  };
}

// ─── login — WorkOS auto-login path ─────────────────────────────────────────

describe("login — WorkOS auto-login", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns existing WorkOS credentials when not expired", async () => {
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour from now
    mockResolveClineAuthCredentials.mockReturnValue({
      accessToken: "workos:eyJvalid",
      refreshToken: "rt_abc",
      expiresAt,
    });
    const callbacks = makeCallbacks();

    const result = await login(callbacks);

    // Returns credentials directly without refresh or manual prompt
    expect(result.access).toBe("workos:eyJvalid");
    expect(result.refresh).toBe("rt_abc");
    expect(result.expires).toBe(expiresAt);
    expect(mockRefreshWorkosToken).not.toHaveBeenCalled();
    expect(callbacks.onAuth).not.toHaveBeenCalled();
  });

  it("refreshes expired WorkOS credentials", async () => {
    const expiresAt = Date.now() - 1000; // expired 1 second ago
    mockResolveClineAuthCredentials.mockReturnValue({
      accessToken: "workos:eyJexpired",
      refreshToken: "rt_expired",
      expiresAt,
    });
    mockRefreshWorkosToken.mockResolvedValue({
      access: "workos:eyJrefreshed",
      refresh: "rt_new",
      expires: Date.now() + 55 * 60 * 1000,
    });
    const callbacks = makeCallbacks();

    const result = await login(callbacks);

    // Refreshed credentials returned
    expect(result.access).toBe("workos:eyJrefreshed");
    expect(result.refresh).toBe("rt_new");
    expect(mockRefreshWorkosToken).toHaveBeenCalledTimes(1);
    expect(callbacks.onAuth).not.toHaveBeenCalled();
  });

  it("refreshes credentials within the refresh margin", async () => {
    // Token expires just within the 5-minute refresh margin
    const expiresAt = Date.now() + 4 * 60 * 1000; // 4 minutes from now
    mockResolveClineAuthCredentials.mockReturnValue({
      accessToken: "workos:eyJabout_to_expire",
      refreshToken: "rt_almost",
      expiresAt,
    });
    mockRefreshWorkosToken.mockResolvedValue({
      access: "workos:eyJrenewed",
      refresh: "rt_renewed",
      expires: Date.now() + 55 * 60 * 1000,
    });
    const callbacks = makeCallbacks();

    const result = await login(callbacks);

    // Refreshed because token is within 5-minute margin
    expect(result.access).toBe("workos:eyJrenewed");
    expect(mockRefreshWorkosToken).toHaveBeenCalledTimes(1);
  });
});

// ─── login — Manual API key paste path ──────────────────────────────────────

describe("login — manual API key paste", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens dashboard and prompts for API key when no Cline CLI credentials", async () => {
    // resolveClineAuthCredentials returns undefined (no Cline CLI login)
    mockResolveClineAuthCredentials.mockReturnValue(undefined);
    const onAuth = vi.fn();
    const callbacks = makeCallbacks({
      onAuth,
      onPrompt: () => "cline_api_key_abcdefghij1234567890",
    });

    const result = await login(callbacks);

    expect(onAuth).toHaveBeenCalledWith({ url: "https://app.cline.bot/settings/api-keys" });
    expect(result.access).toBe("cline_api_key_abcdefghij1234567890");
    expect(result.refresh).toBe("cline_api_key_abcdefghij1234567890");
  });

  it("throws on empty API key", async () => {
    mockResolveClineAuthCredentials.mockReturnValue(undefined);
    const callbacks = makeCallbacks({ onPrompt: () => "" });

    await expect(login(callbacks)).rejects.toThrow("No ClinePass API key provided");
  });

  it("trims whitespace from pasted API key", async () => {
    mockResolveClineAuthCredentials.mockReturnValue(undefined);
    const callbacks = makeCallbacks({
      onPrompt: () => "  cline_api_key_with_spaces_123456  ",
    });

    const result = await login(callbacks);

    expect(result.access).toBe("cline_api_key_with_spaces_123456");
  });

  it("warns on unusually short API key (< 20 chars)", async () => {
    mockResolveClineAuthCredentials.mockReturnValue(undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const callbacks = makeCallbacks({ onPrompt: () => "short_key_123" });

    await login(callbacks);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("[clinepass]");
    expect(warnSpy.mock.calls[0][0]).toContain("unusually short");
    expect(warnSpy.mock.calls[0][0]).toContain("12 chars");
    warnSpy.mockRestore();
  });

  it("does not warn on API key >= 20 chars", async () => {
    mockResolveClineAuthCredentials.mockReturnValue(undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const callbacks = makeCallbacks({
      onPrompt: () => "abcdefghij1234567890", // exactly 20 chars
    });

    await login(callbacks);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("removes terminal paste wrappers from pasted key", async () => {
    mockResolveClineAuthCredentials.mockReturnValue(undefined);
    const esc = String.fromCharCode(27);
    const pastedKey = `${esc}[200~cline_api_key_abcdefghij12345${esc}[201~`;
    const callbacks = makeCallbacks({ onPrompt: () => pastedKey });

    const result = await login(callbacks);

    expect(result.access).toBe("cline_api_key_abcdefghij12345");
  });
});

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
