import { describe, it, expect } from "vitest";
import {
  DEFAULT_API_BASE,
  DEFAULT_ENDPOINT,
  ENV_API_KEY,
  PROVIDER_NAME,
  resolveApiBase,
  sanitizeApiKey,
  buildEndpointUrl,
} from "../../src/env.js";

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
