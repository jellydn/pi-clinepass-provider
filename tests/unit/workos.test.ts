import { describe, it, expect } from "vitest";
import {
  resolveClineAuthCredentials,
  isWorkosToken,
  WORKOS_TOKEN_PREFIX,
  CLINE_REFRESH_ENDPOINT,
} from "../../src/workos.js";

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
