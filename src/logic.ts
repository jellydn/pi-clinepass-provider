/**
 * Pure logic for ClinePass provider — testable without pi runtime.
 *
 * Handles model definitions, API key resolution, and environment helpers for
 * Cline's OpenAI-compatible API (https://api.cline.bot/api/v1/chat/completions).
 *
 * @module clinepass-logic
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ─── Type helpers ────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const DEFAULT_API_BASE = "https://api.cline.bot";
export const DEFAULT_ENDPOINT = "/api/v1/chat/completions";
export const ENV_API_KEY = "CLINE_API_KEY";

/**
 * The ClinePass provider name used in pi (pi registerProvider name).
 * Models are referenced as `clinepass/<model-slug>`.
 */
export const PROVIDER_NAME = "clinepass";

// ─── Model Definitions ─────────────────────────────────────────────────────

/**
 * ClinePass curated open-weight coding models.
 *
 * Model IDs use the full ClinePass slug (e.g. "cline-pass/glm-5.2") as
 * documented at https://docs.cline.bot/getting-started/clinepass — these are
 * the values Cline's API expects in the `model` field.
 *
 * `contextWindow` is in tokens; `maxTokens` is the max output tokens.
 * Reference pricing ($/M tokens) is from the ClinePass docs and is used for
 * usage tracking — ClinePass itself is a flat $9.99/mo subscription.
 */
export interface ModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  input: readonly ["text"];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
}

export const MODELS: readonly ModelConfig[] = [
  {
    id: "cline-pass/glm-5.2",
    name: "GLM-5.2 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/kimi-k2.7-code",
    name: "Kimi K2.7 Code (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.95, output: 4.0, cacheRead: 0.19, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/kimi-k2.6",
    name: "Kimi K2.6 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.95, output: 4.0, cacheRead: 0.16, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/deepseek-v4-pro",
    name: "DeepSeek V4 Pro (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 1.74, output: 3.48, cacheRead: 0.0145, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 384_000,
  },
  {
    id: "cline-pass/deepseek-v4-flash",
    name: "DeepSeek V4 Flash (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 384_000,
  },
  {
    id: "cline-pass/mimo-v2.5",
    name: "MiMo-V2.5 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/mimo-v2.5-pro",
    name: "MiMo-V2.5-Pro (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 1.74, output: 3.48, cacheRead: 0.0145, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/minimax-m3",
    name: "MiniMax M3 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
    contextWindow: 1_048_576,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/qwen3.7-max",
    name: "Qwen3.7 Max (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 2.5, output: 7.5, cacheRead: 0.5, cacheWrite: 3.125 },
    contextWindow: 262_144,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/qwen3.7-plus",
    name: "Qwen3.7 Plus (ClinePass)",
    reasoning: true,
    input: ["text"],
    // Qwen3.7 Plus has tiered pricing; we use the ≤256K rate as the default.
    cost: { input: 0.4, output: 1.6, cacheRead: 0.04, cacheWrite: 0.5 },
    contextWindow: 1_048_576,
    maxTokens: 131_072,
  },
];

/**
 * Return the model IDs registered for the ClinePass provider.
 */
export function modelIds(): string[] {
  return MODELS.map((m) => m.id);
}

// ─── Dynamic Model Discovery ───────────────────────────────────────────────

/** Endpoint for listing models (OpenAI-compatible, relative to API base). */
export const MODELS_ENDPOINT = "/api/v1/models";

/** Timeout for the model-list fetch (ms). Keeps registration responsive. */
export const MODELS_FETCH_TIMEOUT_MS = 5_000;

/**
 * Raw model entry from the Cline API `/models` endpoint.
 * Follows the OpenAI-compatible format, with optional Cline extensions.
 */
interface RawModelEntry {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  max_output_tokens?: unknown;
  pricing?: unknown;
  reasoning?: unknown;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Parse a single raw model entry into a `ModelConfig`.
 * Falls back to static-model values when the API doesn't provide a field.
 */
function parseRemoteModel(raw: RawModelEntry, fallback?: ModelConfig): ModelConfig | undefined {
  const id = stringValue(raw.id);
  if (!id) return undefined;

  const name = stringValue(raw.name) ?? id;
  const contextWindow = numberValue(raw.context_length) ?? fallback?.contextWindow ?? 128_000;
  const maxTokens = numberValue(raw.max_output_tokens) ?? fallback?.maxTokens ?? 8_192;
  const reasoning = booleanValue(raw.reasoning) ?? fallback?.reasoning ?? true;

  // Parse pricing — OpenAI format uses string $/token; we use $/M tokens
  const pricing = isRecord(raw.pricing) ? raw.pricing : undefined;
  const cost = {
    input:
      numberValue(pricing?.prompt) != null
        ? numberValue(pricing?.prompt)! * 1_000_000
        : (fallback?.cost.input ?? 0),
    output:
      numberValue(pricing?.completion) != null
        ? numberValue(pricing?.completion)! * 1_000_000
        : (fallback?.cost.output ?? 0),
    cacheRead:
      numberValue(pricing?.cached_input) != null
        ? numberValue(pricing?.cached_input)! * 1_000_000
        : (fallback?.cost.cacheRead ?? 0),
    cacheWrite: fallback?.cost.cacheWrite ?? 0,
  };

  return { id, name, reasoning, input: ["text"], cost, contextWindow, maxTokens };
}

/**
 * Options for fetching remote models. All I/O is injectable for testability.
 */
export interface RemoteModelsOptions {
  apiBase?: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

/**
 * Fetch the model list from the Cline API `/models` endpoint.
 *
 * Returns parsed `ModelConfig[]` on success, or `undefined` on any error
 * (network failure, non-OK response, parse error, empty list). Callers
 * should fall back to the static `MODELS` array when this returns `undefined`.
 *
 * The endpoint follows the OpenAI-compatible format: `{ data: [{ id, ... }] }`
 * or a bare array `[{ id, ... }]`. Only models with `cline-pass/` prefixed IDs
 * are included.
 */
export async function fetchRemoteModels(
  options: RemoteModelsOptions = {},
): Promise<ModelConfig[] | undefined> {
  const apiBase = options.apiBase ?? resolveApiBase();
  const apiKey = options.apiKey;
  const fetchFn = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? MODELS_FETCH_TIMEOUT_MS;

  if (!apiKey || !fetchFn) return undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(`${apiBase}${MODELS_ENDPOINT}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!response.ok) return undefined;

    const json: unknown = await response.json();
    const rawList: RawModelEntry[] = Array.isArray(json)
      ? json
      : isRecord(json) && Array.isArray(json.data)
        ? (json.data as RawModelEntry[])
        : [];

    if (rawList.length === 0) return undefined;

    // Build a lookup from the static MODELS for fallback values
    const staticById = new Map(MODELS.map((m) => [m.id, m]));

    const parsed = rawList
      .filter((raw) => {
        const id = stringValue(raw?.id);
        return id?.startsWith("cline-pass/");
      })
      .map((raw) => parseRemoteModel(raw, staticById.get(stringValue(raw.id)!)))
      .filter((m): m is ModelConfig => m !== undefined);

    return parsed.length > 0 ? parsed : undefined;
  } catch {
    // Network error, timeout, or parse failure — fall back to static list
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the model list for registration.
 *
 * Tries the remote API first (if an API key is available), falling back to
 * the static `MODELS` array on any error. This keeps the extension functional
 * even when the Cline API doesn't expose a `/models` endpoint yet (currently
 * returns 404), and automatically benefits from dynamic discovery when the
 * endpoint becomes available.
 *
 * @param apiKey The API key to use for the fetch (optional)
 * @param options I/O options for testability
 */
export async function resolveModels(
  apiKey?: string,
  options: RemoteModelsOptions = {},
): Promise<readonly ModelConfig[]> {
  if (apiKey) {
    const remote = await fetchRemoteModels({ ...options, apiKey });
    if (remote && remote.length > 0) {
      return remote;
    }
  }
  return MODELS;
}

// ─── API Key Resolution ──────────────────────────────────────────────────────

/**
 * Default auth file paths checked in order.
 *
 * 1. ~/.cline/data/settings/providers.json — Cline CLI credentials (nested)
 * 2. ~/.pi/agent/auth.json — pi's OAuth credentials store
 */
export function defaultAuthPaths(home: string): string[] {
  return [
    join(home, ".cline", "data", "settings", "providers.json"),
    join(home, ".pi", "agent", "auth.json"),
  ];
}

export interface AuthKeyOptions {
  env?: Record<string, string | undefined>;
  authPaths?: readonly string[];
  homeDir?: () => string;
  readFile?: (path: string) => string;
  fileExists?: (path: string) => boolean;
}

/**
 * Extract a ClinePass API key from the Cline CLI's nested providers.json
 * structure: providers["cline-pass"].settings.apiKey or
 * providers["cline-pass"].settings.auth.accessToken
 *
 * Note: the auth.accessToken from the Cline CLI is a short-lived WorkOS OAuth
 * token — it may be expired. Only static apiKey values are returned from this
 * function; WorkOS access tokens are handled separately via
 * resolveClineAuthCredentials() + the OAuth refresh flow in oauth.ts.
 */
function resolveClineProvidersKey(parsed: Record<string, unknown>): string | undefined {
  const providers = isRecord(parsed.providers) ? parsed.providers : undefined;
  if (!providers) return undefined;

  // Check both "cline-pass" and "cline" provider entries
  for (const key of ["cline-pass", "cline"]) {
    const provider = isRecord(providers[key]) ? providers[key] : undefined;
    if (!provider) continue;
    const settings = isRecord(provider.settings) ? provider.settings : undefined;
    if (!settings) continue;

    // Static API key: settings.apiKey (long-lived, safe to use directly)
    const apiKey = stringValue(settings.apiKey);
    if (apiKey) return apiKey;

    // Note: we intentionally do NOT return settings.auth.accessToken here.
    // That is a short-lived WorkOS OAuth token that expires after ~1 hour and
    // cannot be used as a static API key. It is handled via the OAuth refresh
    // flow in oauth.ts (resolveClineAuthCredentials + refreshWorkosToken).
  }
  return undefined;
}

/**
 * Resolve the ClinePass API key.
 * Priority: provided key → CLINE_API_KEY env var → auth files
 *
 * Auth files checked:
 * - ~/.cline/data/settings/providers.json (Cline CLI nested format):
 *   {providers: {"cline-pass": {settings: {apiKey: "..."}}}}
 *   {providers: {"cline-pass": {settings: {auth: {accessToken: "..."}}}}}
 * - ~/.pi/agent/auth.json (pi OAuth format):
 *   {"clinepass": "..."} or {"clinepass": {"type":"oauth","access": "..."}}
 */
export function resolveApiKey(
  providedKey?: string,
  options: AuthKeyOptions = {},
): string | undefined {
  if (providedKey) return providedKey;

  const env = options.env ?? process.env;
  if (env[ENV_API_KEY]) return env[ENV_API_KEY];

  const home = options.homeDir?.() ?? homedir();
  const authPaths = options.authPaths ?? defaultAuthPaths(home);
  const readFile = options.readFile ?? ((p: string) => readFileSync(p, "utf-8"));
  const fileExists = options.fileExists ?? ((p: string) => existsSync(p));

  for (const authPath of authPaths) {
    try {
      if (!fileExists(authPath)) continue;
      const parsed: unknown = JSON.parse(readFile(authPath));
      if (!isRecord(parsed)) continue;

      // Cline CLI nested format: providers["cline-pass"].settings.apiKey or .auth.accessToken
      const clineKey = resolveClineProvidersKey(parsed);
      if (clineKey) return clineKey;

      // pi auth.json format: direct apiKey field
      const apiKey = stringValue(parsed.apiKey);
      if (apiKey) return apiKey;

      // pi auth.json format: clinepass field (string or OAuth object)
      const cpField = parsed.clinepass;
      if (typeof cpField === "string") return cpField;
      if (isRecord(cpField)) {
        const access = stringValue(cpField.access);
        if (access) return access;
      }
    } catch (e) {
      // Distinguish "file absent" (expected, skip silently) from
      // "file present but corrupt/unreadable" (actionable, warn).
      // Never log file contents or the resolved key.
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("ENOENT") && !msg.includes("not found")) {
        console.warn(`[clinepass] Warning: failed to read auth file ${authPath}: ${msg}`);
      }
    }
  }

  return undefined;
}

// ─── WorkOS OAuth Token Support ─────────────────────────────────────────────

/** Prefix that identifies WorkOS OAuth access tokens (e.g. "workos:eyJ..."). */
export const WORKOS_TOKEN_PREFIX = "workos:";

/** Cline's server-side token refresh endpoint (relative to the API base). */
export const CLINE_REFRESH_ENDPOINT = "/api/v1/auth/refresh";

/** Conservative token lifetime estimate (WorkOS tokens last ~1 hour). */
export const WORKOS_TOKEN_LIFETIME_MS = 55 * 60 * 1000;

/** Refresh tokens 5 minutes before expiry to avoid race conditions. */
export const WORKOS_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * WorkOS OAuth credentials extracted from the Cline CLI's providers.json.
 * These are short-lived (~1 hour) and need refresh via Cline's endpoint.
 */
export interface ClineAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Check whether a token string is a WorkOS OAuth access token.
 * WorkOS tokens are prefixed with "workos:" (e.g. "workos:eyJ...").
 */
export function isWorkosToken(token: string): boolean {
  return token.startsWith(WORKOS_TOKEN_PREFIX);
}

/**
 * Extract WorkOS OAuth credentials (accessToken + refreshToken + expiresAt)
 * from the Cline CLI's providers.json.
 *
 * Looks for providers["cline-pass"].settings.auth or providers["cline"].settings.auth.
 * Returns undefined if no valid WorkOS credentials (both accessToken and
 * refreshToken) are found.
 *
 * Note: the accessToken may be expired — callers should refresh via
 * Cline's /api/v1/auth/refresh endpoint before use.
 */
export function resolveClineAuthCredentials(
  options: AuthKeyOptions = {},
): ClineAuthCredentials | undefined {
  const home = options.homeDir?.() ?? homedir();
  const authPaths = options.authPaths ?? defaultAuthPaths(home);
  const readFile = options.readFile ?? ((p: string) => readFileSync(p, "utf-8"));
  const fileExists = options.fileExists ?? ((p: string) => existsSync(p));

  for (const authPath of authPaths) {
    try {
      if (!fileExists(authPath)) continue;
      const parsed: unknown = JSON.parse(readFile(authPath));
      if (!isRecord(parsed)) continue;

      const providers = isRecord(parsed.providers) ? parsed.providers : undefined;
      if (!providers) continue;

      for (const key of ["cline-pass", "cline"]) {
        const provider = isRecord(providers[key]) ? providers[key] : undefined;
        if (!provider) continue;
        const settings = isRecord(provider.settings) ? provider.settings : undefined;
        if (!settings) continue;
        const auth = isRecord(settings.auth) ? settings.auth : undefined;
        if (!auth) continue;

        const accessToken = stringValue(auth.accessToken);
        const refreshToken = stringValue(auth.refreshToken);
        if (!accessToken || !refreshToken) continue;

        const expiresAt =
          typeof auth.expiresAt === "number"
            ? auth.expiresAt
            : Date.now() + WORKOS_TOKEN_LIFETIME_MS;

        return { accessToken, refreshToken, expiresAt };
      }
    } catch (e) {
      // Distinguish "file absent" (expected, skip silently) from
      // "file present but corrupt/unreadable" (actionable, warn).
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("ENOENT") && !msg.includes("not found")) {
        console.warn(`[clinepass] Warning: failed to read auth file ${authPath}: ${msg}`);
      }
    }
  }
  return undefined;
}

// ─── Error Classification ───────────────────────────────────────────────────

/**
 * Classified error type from a ClinePass API response.
 *
 * ClinePass returns specific HTTP status codes for different failure modes
 * (per Cline PR #11355):
 * - 403: user not subscribed, or ClinePass used at organization level
 * - 401: authentication credentials invalid or expired
 * - 429: rate limit exceeded
 */
export type ClinePassErrorType = "not_subscribed" | "auth_expired" | "rate_limited" | "unknown";

/**
 * User-friendly error messages for ClinePass-specific failures.
 */
export const CLINEPASS_ERROR_MESSAGES: Record<ClinePassErrorType, string> = {
  not_subscribed:
    "ClinePass subscription required. Visit app.cline.bot to subscribe, or run `pi /login` to re-authenticate.",
  auth_expired:
    "ClinePass authentication expired. Run `pi /login` and select ClinePass to refresh your credentials.",
  rate_limited:
    "ClinePass rate limit reached. Wait a moment and try again, or upgrade your plan at app.cline.bot.",
  unknown: "ClinePass request failed. Check your subscription at app.cline.bot or run `pi /login`.",
};

/**
 * Classify a ClinePass API error message into a specific error type.
 *
 * The OpenAI SDK surfaces HTTP error status codes and response body text in
 * the error message. This function pattern-matches against common 403/401/429
 * indicators to produce a clear, actionable message for the user.
 *
 * @param errorMessage The raw error message from the provider response
 * @returns The classified error type and a user-friendly message
 */
export function classifyClinePassError(errorMessage: string): {
  type: ClinePassErrorType;
  message: string;
} {
  const lower = errorMessage.toLowerCase();

  // 403 — not subscribed or org-level restriction (per Cline PR #11355)
  if (
    lower.includes("403") ||
    lower.includes("forbidden") ||
    lower.includes("subscription required") ||
    lower.includes("not subscribed")
  ) {
    return { type: "not_subscribed", message: CLINEPASS_ERROR_MESSAGES.not_subscribed };
  }

  // 401 — auth expired or invalid credentials
  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid_api_key")
  ) {
    return { type: "auth_expired", message: CLINEPASS_ERROR_MESSAGES.auth_expired };
  }

  // 429 — rate limited
  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("rate_limit")
  ) {
    return { type: "rate_limited", message: CLINEPASS_ERROR_MESSAGES.rate_limited };
  }

  return { type: "unknown", message: CLINEPASS_ERROR_MESSAGES.unknown };
}

// ─── Environment Helpers ────────────────────────────────────────────────────

/**
 * Resolve the API base URL, allowing override via CLINE_API_BASE env var.
 */
export function resolveApiBase(env: Record<string, string | undefined> = process.env): string {
  return env.CLINE_API_BASE ?? DEFAULT_API_BASE;
}

/**
 * Remove terminal paste wrappers and control chars from API key input.
 */
export function sanitizeApiKey(input: string): string {
  const esc = String.fromCharCode(27);
  return Array.from(
    input
      .replaceAll(`${esc}[200~`, "")
      .replaceAll(`${esc}[201~`, "")
      .replaceAll("[200~", "")
      .replaceAll("[201~", ""),
  )
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .trim();
}

/**
 * Build the full chat completions endpoint URL from a base URL.
 *
 * Utility for documentation and tests — the actual extension uses pi's
 * built-in openai-completions streaming, which appends `/chat/completions`
 * to the provider's baseUrl (`${apiBase}/api/v1`) automatically.
 */
export function buildEndpointUrl(base: string): string {
  return `${base}${DEFAULT_ENDPOINT}`;
}
