import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveApiKey,
  defaultAuthPaths,
  modelIds,
  MODELS,
  PROVIDER_NAME,
  ENV_API_KEY,
  DEFAULT_API_BASE,
  DEFAULT_ENDPOINT,
  resolveApiBase,
  sanitizeApiKey,
  buildEndpointUrl,
  resolveClineAuthCredentials,
  isWorkosToken,
  WORKOS_TOKEN_PREFIX,
  CLINE_REFRESH_ENDPOINT,
  fetchRemoteModels,
  resolveModels,
} from "../../src/logic.js";

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
    // WorkOS access tokens are short-lived and handled via the OAuth refresh
    // flow, not returned as static API key fallbacks
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
    // Should NOT return the expired workos: token — only static apiKey is used
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

// ─── modelIds / MODELS ──────────────────────────────────────────────────────

describe("modelIds", () => {
  it("returns all model IDs", () => {
    const ids = modelIds();
    expect(ids).toHaveLength(MODELS.length);
    expect(ids).toContain("cline-pass/glm-5.2");
    expect(ids).toContain("cline-pass/kimi-k2.7-code");
    expect(ids).toContain("cline-pass/deepseek-v4-flash");
  });

  it("all IDs start with cline-pass/", () => {
    for (const id of modelIds()) {
      expect(id.startsWith("cline-pass/")).toBe(true);
    }
  });
});

describe("MODELS", () => {
  it("has at least one model", () => {
    expect(MODELS.length).toBeGreaterThan(0);
  });

  it("all models have valid cost and context fields", () => {
    for (const m of MODELS) {
      expect(m.cost.input).toBeGreaterThanOrEqual(0);
      expect(m.cost.output).toBeGreaterThanOrEqual(0);
      expect(m.cost.cacheRead).toBeGreaterThanOrEqual(0);
      expect(m.cost.cacheWrite).toBeGreaterThanOrEqual(0);
      expect(m.contextWindow).toBeGreaterThan(0);
      expect(m.maxTokens).toBeGreaterThan(0);
      expect(m.reasoning).toBe(true); // all ClinePass models support reasoning
      expect(m.input).toEqual(["text"]);
    }
  });
});

// ─── Constants ──────────────────────────────────────────────────────────────

describe("constants", () => {
  it("exports correct provider name", () => {
    expect(PROVIDER_NAME).toBe("clinepass");
  });

  it("exports correct env var name", () => {
    expect(ENV_API_KEY).toBe("CLINE_API_KEY");
  });

  it("exports correct default API base", () => {
    expect(DEFAULT_API_BASE).toBe("https://api.cline.bot");
  });

  it("exports correct endpoint path", () => {
    expect(DEFAULT_ENDPOINT).toBe("/api/v1/chat/completions");
  });
});

// ─── resolveApiBase ─────────────────────────────────────────────────────────

describe("resolveApiBase", () => {
  it("returns default when env not set", () => {
    expect(resolveApiBase({})).toBe(DEFAULT_API_BASE);
  });

  it("returns override from CLINE_API_BASE", () => {
    expect(resolveApiBase({ CLINE_API_BASE: "https://custom.example.com" })).toBe(
      "https://custom.example.com",
    );
  });
});

// ─── sanitizeApiKey ─────────────────────────────────────────────────────────

describe("sanitizeApiKey", () => {
  it("trims whitespace", () => {
    expect(sanitizeApiKey("  cline_test  ")).toBe("cline_test");
  });

  it("removes terminal paste wrappers", () => {
    const esc = String.fromCharCode(27);
    expect(sanitizeApiKey(`${esc}[200~cline_test${esc}[201~`)).toBe("cline_test");
  });

  it("removes control characters", () => {
    expect(sanitizeApiKey("cline_\x00test")).toBe("cline_test");
  });

  it("removes DEL (char code 127)", () => {
    expect(sanitizeApiKey("cline_\x7Ftest")).toBe("cline_test");
  });

  it("handles combined escaped and unescaped bracketed-paste", () => {
    const esc = String.fromCharCode(27);
    expect(sanitizeApiKey(`${esc}[200~cline_key[201~`)).toBe("cline_key");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizeApiKey("   \t\n  ")).toBe("");
  });
});

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
    expect(creds?.expiresAt).toBeGreaterThan(Date.now()); // defaulted to future
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

// ─── WorkOS constants ───────────────────────────────────────────────────────

describe("WorkOS constants", () => {
  it("exports the workos: prefix", () => {
    expect(WORKOS_TOKEN_PREFIX).toBe("workos:");
  });

  it("exports the Cline refresh endpoint path", () => {
    expect(CLINE_REFRESH_ENDPOINT).toBe("/api/v1/auth/refresh");
  });
});

// ─── fetchRemoteModels ─────────────────────────────────────────────────────

describe("fetchRemoteModels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns undefined when no API key is provided", async () => {
    const result = await fetchRemoteModels({ apiKey: undefined });
    expect(result).toBeUndefined();
  });

  it("returns undefined on non-OK response (e.g. 404)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toBeUndefined();
  });

  it("returns undefined on network error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toBeUndefined();
  });

  it("parses OpenAI-compatible { data: [...] } response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "cline-pass/glm-5.2",
              name: "GLM-5.2",
              context_length: 200_000,
              max_output_tokens: 131_072,
              pricing: { prompt: "0.0000014", completion: "0.0000044", cached_input: "0.00000026" },
              reasoning: true,
            },
            {
              id: "cline-pass/deepseek-v4-flash",
              name: "DeepSeek V4 Flash",
              context_length: 1_000_000,
              max_output_tokens: 384_000,
              reasoning: true,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(2);
    expect(result![0].id).toBe("cline-pass/glm-5.2");
    expect(result![0].name).toBe("GLM-5.2");
    expect(result![0].contextWindow).toBe(200_000);
    expect(result![0].maxTokens).toBe(131_072);
    expect(result![0].reasoning).toBe(true);
    // Pricing converted from $/token to $/M tokens
    expect(result![0].cost.input).toBeCloseTo(1.4, 1);
    expect(result![0].cost.output).toBeCloseTo(4.4, 1);
  });

  it("parses bare array response format", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify([{ id: "cline-pass/kimi-k2.7-code", name: "Kimi K2.7 Code" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("cline-pass/kimi-k2.7-code");
  });

  it("filters out non-cline-pass models", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "cline-pass/glm-5.2", name: "GLM-5.2" },
            { id: "openai/gpt-5", name: "GPT-5" },
            { id: "anthropic/claude-4", name: "Claude 4" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("cline-pass/glm-5.2");
  });

  it("uses static model fallback values for missing fields", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "cline-pass/glm-5.2" }], // only id, no other fields
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toHaveLength(1);
    // Falls back to static MODELS values
    const staticModel = MODELS.find((m) => m.id === "cline-pass/glm-5.2");
    expect(result![0].contextWindow).toBe(staticModel!.contextWindow);
    expect(result![0].maxTokens).toBe(staticModel!.maxTokens);
    expect(result![0].cost.input).toBe(staticModel!.cost.input);
  });

  it("returns undefined for empty model list", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const result = await fetchRemoteModels({ apiKey: "test_key" });
    expect(result).toBeUndefined();
  });
});

// ─── resolveModels ─────────────────────────────────────────────────────────

describe("resolveModels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to static MODELS when no API key", async () => {
    const result = await resolveModels(undefined);
    expect(result).toEqual(MODELS);
  });

  it("falls back to static MODELS when fetch fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );
    const result = await resolveModels("test_key");
    expect(result).toEqual(MODELS);
  });

  it("returns remote models when fetch succeeds", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "cline-pass/glm-5.2", name: "GLM-5.2 Updated" },
            { id: "cline-pass/new-model", name: "New Model" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await resolveModels("test_key");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("cline-pass/glm-5.2");
    expect(result[0].name).toBe("GLM-5.2 Updated");
    expect(result[1].id).toBe("cline-pass/new-model");
  });
});

// ─── buildEndpointUrl ───────────────────────────────────────────────────────

describe("buildEndpointUrl", () => {
  it("builds the full chat completions URL", () => {
    expect(buildEndpointUrl(DEFAULT_API_BASE)).toBe(
      "https://api.cline.bot/api/v1/chat/completions",
    );
  });

  it("works with a custom base", () => {
    expect(buildEndpointUrl("https://staging.cline.bot")).toBe(
      "https://staging.cline.bot/api/v1/chat/completions",
    );
  });
});
