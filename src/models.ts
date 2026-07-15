/**
 * ClinePass model definitions and dynamic model discovery.
 *
 * @module clinepass-models
 */

import { isRecord, stringValue, numberValue, booleanValue } from "./utils.js";
import { resolveApiBase } from "./env.js";

// ─── Model Definitions ─────────────────────────────────────────────────────

/** Pi thinking levels that models map to provider-specific reasoning_effort. */
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

/**
 * Explicit capability matrix mapping every thinking level to a
 * provider-specific `reasoning_effort` string or `null` (unsupported).
 * Every model must declare all six levels — there are no implicit defaults.
 */
export type ThinkingLevelMap = Readonly<Record<ThinkingLevel, string | null>>;

/**
 * Default thinking level map for remote models without a static fallback.
 * Assumes low/medium/high are supported and marks minimal/xhigh unsupported.
 * "off" maps to "none" for the ClinePass API.
 */
export const DEFAULT_THINKING_LEVEL_MAP: ThinkingLevelMap = {
  off: "none",
  minimal: null,
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: null,
};

/**
 * All-null thinking level map used when a model reports reasoning: false.
 * Every level is unsupported — reasoning is simply not available.
 */
export const NO_THINKING_MAP: ThinkingLevelMap = {
  off: null,
  minimal: null,
  low: null,
  medium: null,
  high: null,
  xhigh: null,
};

/**
 * OpenAI-compat flags for ClinePass chat completions.
 *
 * ClinePass only accepts classic roles (`system`, `assistant`, `user`, `tool`,
 * `function`). pi-ai defaults to `developer` for reasoning models unless
 * `supportsDeveloperRole` is false (see pi-ai README).
 */
export interface ClinePassOpenAICompat {
  readonly supportsDeveloperRole: boolean;
  readonly thinkingFormat?: string;
}

export const CLINEPASS_OPENAI_COMPAT: ClinePassOpenAICompat = {
  supportsDeveloperRole: false,
};

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
  /**
   * Maps every pi thinking level to a provider-specific reasoning_effort
   * string, or `null` to mark a level as unsupported. Every model must
   * declare all six levels explicitly — there are no implicit defaults.
   */
  thinkingLevelMap: ThinkingLevelMap;
  /** pi-ai openai-completions compat overrides for the ClinePass API. */
  compat: ClinePassOpenAICompat;
}

/** Static catalog entries; per-model compat overrides merge with CLINEPASS_OPENAI_COMPAT. */
interface ModelConfigBase extends Omit<ModelConfig, "compat"> {
  compat?: Partial<ClinePassOpenAICompat>;
}

const MODELS_BASE: readonly ModelConfigBase[] = [
  {
    id: "cline-pass/glm-5.2",
    name: "GLM-5.2 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 131_072,
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
    },
  },
  {
    id: "cline-pass/kimi-k2.7-code",
    name: "Kimi K2.7 Code (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.95, output: 4.0, cacheRead: 0.19, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
    thinkingLevelMap: {
      off: null,
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
    },
  },
  {
    id: "cline-pass/kimi-k2.6",
    name: "Kimi K2.6 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.95, output: 4.0, cacheRead: 0.16, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
    thinkingLevelMap: {
      off: null,
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
    },
  },
  {
    id: "cline-pass/deepseek-v4-pro",
    name: "DeepSeek V4 Pro (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 1.74, output: 3.48, cacheRead: 0.0145, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 384_000,
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: null,
      medium: null,
      high: "high",
      xhigh: "high",
    },
  },
  {
    id: "cline-pass/deepseek-v4-flash",
    name: "DeepSeek V4 Flash (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 384_000,
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: null,
      medium: null,
      high: "high",
      xhigh: "high",
    },
  },
  {
    id: "cline-pass/mimo-v2.5",
    name: "MiMo-V2.5 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
    },
  },
  {
    id: "cline-pass/mimo-v2.5-pro",
    name: "MiMo-V2.5-Pro (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 1.74, output: 3.48, cacheRead: 0.0145, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
    },
  },
  {
    id: "cline-pass/minimax-m3",
    name: "MiniMax M3 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
    contextWindow: 1_048_576,
    maxTokens: 131_072,
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
    },
  },
  {
    id: "cline-pass/qwen3.7-max",
    name: "Qwen3.7 Max (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 2.5, output: 7.5, cacheRead: 0.5, cacheWrite: 3.125 },
    contextWindow: 262_144,
    maxTokens: 131_072,
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
    },
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
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
    },
  },
];

export const MODELS: readonly ModelConfig[] = MODELS_BASE.map((model) => ({
  ...model,
  compat: {
    ...CLINEPASS_OPENAI_COMPAT,
    ...model.compat,
  },
}));

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

/** Convert a per-token price from the API to our $/M tokens representation. */
function toMicroPerToken(val: unknown, fallbackVal: number): number {
  const n = numberValue(val);
  return n != null ? n * 1_000_000 : fallbackVal;
}

/**
 * Parse a single raw model entry into a `ModelConfig`.
 * Falls back to static-model values when the API doesn't provide a field.
 */
function parseRemoteModel(raw: RawModelEntry, fallback?: ModelConfig): ModelConfig | undefined {
  const id = stringValue(raw.id);
  if (!id) return undefined;

  const name = stringValue(raw.name) ?? fallback?.name ?? id;
  const contextWindow = numberValue(raw.context_length) ?? fallback?.contextWindow ?? 128_000;
  const maxTokens = numberValue(raw.max_output_tokens) ?? fallback?.maxTokens ?? 8_192;
  const reasoning = booleanValue(raw.reasoning) ?? fallback?.reasoning ?? true;

  // Parse pricing — OpenAI format uses string $/token; we use $/M tokens
  const pricing = isRecord(raw.pricing) ? raw.pricing : undefined;
  const cost = {
    input: toMicroPerToken(pricing?.prompt, fallback?.cost.input ?? 0),
    output: toMicroPerToken(pricing?.completion, fallback?.cost.output ?? 0),
    cacheRead: toMicroPerToken(pricing?.cached_input, fallback?.cost.cacheRead ?? 0),
    cacheWrite: fallback?.cost.cacheWrite ?? 0,
  };

  return {
    id,
    name,
    reasoning,
    input: ["text"],
    cost,
    contextWindow,
    maxTokens,
    // Attach a reasoning-aware map: static fallback → sensible default → all-null.
    thinkingLevelMap: reasoning
      ? (fallback?.thinkingLevelMap ?? DEFAULT_THINKING_LEVEL_MAP)
      : NO_THINKING_MAP,
    compat: {
      ...CLINEPASS_OPENAI_COMPAT,
      ...fallback?.compat,
    },
  };
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

    const parsed = rawList.reduce<ModelConfig[]>((acc, raw) => {
      const id = stringValue(raw?.id);
      if (!id?.startsWith("cline-pass/")) return acc;
      const model = parseRemoteModel(raw, staticById.get(id));
      if (model) acc.push(model);
      return acc;
    }, []);

    return parsed.length > 0 ? parsed : undefined;
  } catch {
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
    if (remote) return remote;
  }
  return MODELS;
}
