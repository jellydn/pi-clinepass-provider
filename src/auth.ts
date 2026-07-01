/**
 * ClinePass API key resolution — testable without pi runtime.
 *
 * @module clinepass-auth
 */

import { isRecord, stringValue } from "./utils.js";
import { ENV_API_KEY, WORKOS_TOKEN_PREFIX } from "./env.js";
import { walkAuthPaths, walkClineProviderSettings, type AuthKeyOptions } from "./config-store.js";

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
  return walkClineProviderSettings(parsed, (settings) => stringValue(settings.apiKey));
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

  return walkAuthPaths(options, (parsed) => {
    // Cline CLI nested format: providers["cline-pass"].settings.apiKey
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
      // Skip OAuth credential records — they contain short-lived WorkOS
      // access tokens (prefixed with "workos:"), not static API keys.
      // The OAuth flow is handled separately via
      // resolveClineAuthCredentials() + refreshWorkosToken().
      if (access && !access.startsWith(WORKOS_TOKEN_PREFIX)) return access;
    }
    return undefined;
  });
}
