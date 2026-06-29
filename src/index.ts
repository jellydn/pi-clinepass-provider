/**
 * ClinePass Provider for pi
 *
 * Adds Cline's ClinePass subscription as a pi provider, giving access to
 * curated open-weight coding models (GLM-5.2, Kimi K2.7, DeepSeek V4, and
 * more) through Cline's OpenAI-compatible API.
 *
 * ClinePass is a $9.99/month subscription with 2-5x API rate limits.
 * See https://docs.cline.bot/getting-started/clinepass
 *
 * Setup:
 *   1. Subscribe at app.cline.bot and create an API key (Settings → API Keys)
 *   2. Set CLINE_API_KEY env var, run `pi /login` and select ClinePass,
 *      or sign in with the Cline CLI (`cline auth`) for automatic reuse
 *   3. Install: pi install git:github.com/jellydn/pi-clinepass-provider
 *   4. Use /model to select a ClinePass model
 *
 * @module pi-clinepass-provider
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  resolveApiBase,
  resolveApiKey,
  resolveModels,
  PROVIDER_NAME,
  ENV_API_KEY,
} from "./logic.js";
import { getApiKey as oauthGetApiKey, login, refreshToken } from "./oauth.js";

// Note on compat/thinkingFormat: ClinePass exposes a standard OpenAI-compatible
// Chat Completions API (per docs.cline.bot). Cline's infrastructure normalizes
// the upstream models (GLM, Kimi, DeepSeek, etc.) to this format, so pi's
// built-in openai-completions streaming and default thinking handling work
// without per-model compat overrides. If reasoning is found to not work
// correctly for a specific model through the live API, add a model-level
// compat override here (e.g. compat: { thinkingFormat: "zai" } for GLM).

// ─── Extension Entry Point ─────────────────────────────────────────────────

export default async function (pi: ExtensionAPI) {
  const apiBase = resolveApiBase();

  // Attempt dynamic model discovery from the Cline API. Falls back to the
  // static MODELS array on any error (network failure, 404, parse error).
  // The fetch has a 5-second timeout so startup is never blocked for long.
  const apiKey = resolveApiKey();
  const models = await resolveModels(apiKey, { apiBase });

  pi.registerProvider(PROVIDER_NAME, {
    name: "ClinePass",
    baseUrl: `${apiBase}/api/v1`,
    apiKey: `$${ENV_API_KEY}`,
    authHeader: true,
    // ClinePass uses the standard OpenAI Chat Completions format, so pi's
    // built-in openai-completions streaming handles SSE + tool calls + usage.
    // No custom streamSimple is needed (unlike providers with proprietary
    // protocols such as Command Code's /alpha/generate NDJSON format).
    api: "openai-completions",
    oauth: {
      name: "ClinePass",
      login,
      refreshToken,
      getApiKey: oauthGetApiKey,
    },
    // Spread the model object so all fields (including future ones like
    // `compat` / `thinkingFormat`) propagate to pi automatically. Only
    // `input` needs transformation: readonly tuple → mutable array.
    models: models.map((model) => ({
      ...model,
      input: [...model.input],
    })),
  });
}
