import { describe, it, expect } from "vitest";
import { resolveApiKey, defaultAuthPaths } from "../../src/auth.js";

// ─── resolveApiKey ──────────────────────────────────────────────────────────

describe("resolveApiKey", () => {
  it("returns provided key first", () => {
    expect(resolveApiKey("cline_provided")).toBe("cline_provided");
  });

  it("falls back to env var", () => {
    expect(resolveApiKey(undefined, { env: { CLINE_API_KEY: "cline_env" } })).toBe("cline_env");
  });

  it("falls back to auth.json with apiKey field", () => {
    const readFile = () => JSON.stringify({ apiKey: "cline_from_file" });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_from_file");
  });

  it("falls back to auth.json with clinepass string field", () => {
    const readFile = () => JSON.stringify({ clinepass: "cline_cp_string" });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_cp_string");
  });

  it("falls back to auth.json with OAuth credentials", () => {
    const readFile = () =>
      JSON.stringify({
        clinepass: {
          type: "oauth",
          access: "cline_oauth_key",
          refresh: "cline_oauth_key",
        },
      });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_oauth_key");
  });

  it("extracts apiKey from Cline CLI nested providers.json (cline-pass)", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": { settings: { apiKey: "cline_static_key" } },
        },
      });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_static_key");
  });

  it("prefers cline-pass apiKey when cline only has auth.accessToken", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": { settings: { apiKey: "cline_pass_key" } },
          cline: { settings: { auth: { accessToken: "workos:cline_key" } } },
        },
      });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_pass_key");
  });

  it("does not return WorkOS auth.accessToken from cline provider (only static apiKey)", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          cline: {
            settings: {
              auth: { accessToken: "workos:oauth_token", refreshToken: "r", expiresAt: 0 },
            },
          },
        },
      });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBeUndefined();
  });

  it("checks ~/.pi/agent/auth.json as fallback", () => {
    const readFile = (p: string) => {
      if (p.includes("providers.json")) throw new Error("ENOENT");
      return JSON.stringify({ apiKey: "cline_from_pi_auth" });
    };
    const fileExists = (p: string) => !p.includes("providers.json");
    expect(
      resolveApiKey(undefined, {
        readFile,
        fileExists,
        authPaths: ["/home/.cline/data/settings/providers.json", "/home/.pi/agent/auth.json"],
      }),
    ).toBe("cline_from_pi_auth");
  });

  it("returns undefined when no key is available", () => {
    const readFile = () => {
      throw new Error("ENOENT");
    };
    const fileExists = () => false;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBeUndefined();
  });

  it("skips malformed auth.json", () => {
    const readFile = () => "not json";
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBeUndefined();
  });

  it("CLINE_API_KEY env wins over populated auth file", () => {
    const readFile = () => JSON.stringify({ apiKey: "cline_from_file" });
    const fileExists = () => true;
    expect(
      resolveApiKey(undefined, {
        env: { CLINE_API_KEY: "cline_env_wins" },
        readFile,
        fileExists,
      }),
    ).toBe("cline_env_wins");
  });

  it("tries auth paths in order when first exists but lacks a key", () => {
    const calls: string[] = [];
    const readFile = (p: string) => {
      calls.push(p);
      if (p.includes("providers.json")) return JSON.stringify({ providers: {} });
      return JSON.stringify({ apiKey: "cline_from_second" });
    };
    const fileExists = () => true;
    expect(
      resolveApiKey(undefined, {
        readFile,
        fileExists,
        authPaths: ["/home/.cline/data/settings/providers.json", "/home/.pi/agent/auth.json"],
      }),
    ).toBe("cline_from_second");
    expect(calls).toHaveLength(2);
  });

  it("handles providers present but not an object", () => {
    const readFile = () => JSON.stringify({ providers: "not_an_object" });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBeUndefined();
  });

  it("handles settings missing in provider entry", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": { tokenSource: "manual" },
        },
      });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBeUndefined();
  });

  it("does not return WorkOS accessToken as a static key fallback", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": {
            settings: {
              auth: { accessToken: "workos:eyJexpired", refreshToken: "rt", expiresAt: 0 },
            },
          },
        },
      });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBeUndefined();
  });
});

// ─── defaultAuthPaths ───────────────────────────────────────────────────────

describe("defaultAuthPaths", () => {
  it("includes Cline CLI providers.json and pi auth.json paths", () => {
    const paths = defaultAuthPaths("/home/user");
    expect(paths).toContain("/home/user/.cline/data/settings/providers.json");
    expect(paths).toContain("/home/user/.pi/agent/auth.json");
  });
});
