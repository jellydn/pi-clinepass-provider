/**
 * ClinePass API key resolution — testable without pi runtime.
 *
 * @module clinepass-auth
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isRecord, stringValue } from "./utils.js";
import { ENV_API_KEY } from "./env.js";

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
