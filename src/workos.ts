/**
 * WorkOS OAuth protocol adapter — credential extraction and token utilities.
 *
 * Owns all WorkOS-specific knowledge: token prefix detection, credential
 * extraction from the Cline CLI's providers.json, and the constants used
 * by the refresh flow in oauth.ts.
 *
 * @module clinepass-workos
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isRecord, stringValue } from "./utils.js";
import { defaultAuthPaths, type AuthKeyOptions } from "./auth.js";

// ─── WorkOS Constants ──────────────────────────────────────────────────────

/** Prefix that identifies WorkOS OAuth access tokens (e.g. "workos:eyJ..."). */
export const WORKOS_TOKEN_PREFIX = "workos:";

/** Cline's server-side token refresh endpoint (relative to the API base). */
export const CLINE_REFRESH_ENDPOINT = "/api/v1/auth/refresh";

/** Conservative token lifetime estimate (WorkOS tokens last ~1 hour). */
export const WORKOS_TOKEN_LIFETIME_MS = 55 * 60 * 1000;

/** Refresh tokens 5 minutes before expiry to avoid race conditions. */
export const WORKOS_REFRESH_MARGIN_MS = 5 * 60 * 1000;

// ─── Types ─────────────────────────────────────────────────────────────────

/**
 * WorkOS OAuth credentials extracted from the Cline CLI's providers.json.
 * These are short-lived (~1 hour) and need refresh via Cline's endpoint.
 */
export interface ClineAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// ─── Token Utilities ───────────────────────────────────────────────────────

/**
 * Check whether a token string is a WorkOS OAuth access token.
 * WorkOS tokens are prefixed with "workos:" (e.g. "workos:eyJ...").
 */
export function isWorkosToken(token: string): boolean {
  return token.startsWith(WORKOS_TOKEN_PREFIX);
}

// ─── Credential Extraction ─────────────────────────────────────────────────

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
