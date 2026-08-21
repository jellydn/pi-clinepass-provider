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
import { resolveApiBase, PROVIDER_NAME, ENV_API_KEY } from "./env.js";
import { resolveApiKey } from "./auth.js";
import { resolveModels } from "./models.js";
import { handleClinePassError } from "./error-handler.js";
import { getApiKey as oauthGetApiKey, login, refreshToken } from "./oauth.js";

// ClinePass exposes OpenAI-compatible chat completions, but rejects the
// `developer` role pi-ai uses by default for reasoning models. Every model
// declares `compat.supportsDeveloperRole: false` in models.ts so system
// prompts use `system`. Per-model thinkingFormat overrides remain available
// if a specific upstream model needs them (e.g. compat.thinkingFormat: "zai").

// ─── Extension Entry Point ─────────────────────────────────────────────────

export default async function (pi: ExtensionAPI) {
  const apiBase = resolveApiBase();

  // Attempt dynamic model discovery from the Cline API. Falls back to the
  // static MODELS array on any error (network failure, 404, parse error).
  // The fetch has a 5-second timeout so startup is never blocked for long.
  const apiKey = resolveApiKey();
  const models = await resolveModels(apiKey, { apiBase });

  // Only register the $CLINE_API_KEY sigil when the env var is set at extension
  // load time. OAuth-only installs should not advertise an unconfigured env-key
  // fallback; when present, the $… form resolves the secret at request time.
  const envApiKey = process.env[ENV_API_KEY]?.trim();

  pi.registerProvider(PROVIDER_NAME, {
    name: "ClinePass",
    baseUrl: `${apiBase}/api/v1`,
    ...(envApiKey ? { apiKey: `$${ENV_API_KEY}` } : {}),
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

  // ─── Error Surface ─────────────────────────────────────────────────────
  //
  // ClinePass returns 403 when the user is not subscribed or tries to use
  // ClinePass at the organization level (per Cline PR #11355). Without this
  // handler, the user sees a generic "Provider returned an error stop reason"
  // message. The handler in error-handler.ts owns the full pipeline:
  // filter → classify → deliver.
  pi.on("message_end", handleClinePassError);
}
