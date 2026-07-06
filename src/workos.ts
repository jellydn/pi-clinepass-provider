/**
 * WorkOS OAuth protocol adapter — credential extraction and token utilities.
 *
 * Owns all WorkOS-specific knowledge: token prefix detection, credential
 * extraction from the Cline CLI's providers.json, and the constants used
 * by the refresh flow in oauth.ts.
 *
 * @module clinepass-workos
 */

import type { OAuthCredentials } from "@earendil-works/pi-ai";
import { isRecord, stringValue } from "./utils.js";
import { resolveApiBase, WORKOS_TOKEN_PREFIX } from "./env.js";
import { walkAuthPaths, type AuthKeyOptions } from "./auth.js";

// Re-export for consumers that import from this module (tests)
export { WORKOS_TOKEN_PREFIX };

// ─── WorkOS Constants ──────────────────────────────────────────────────────

/** Cline's server-side token refresh endpoint (relative to the API base). */
export const CLINE_REFRESH_ENDPOINT = "/api/v1/auth/refresh";

/** Conservative token lifetime estimate (WorkOS tokens last ~1 hour). */
export const WORKOS_TOKEN_LIFETIME_MS = 55 * 60 * 1000;

/** Refresh tokens 5 minutes before expiry to avoid race conditions. */
export const WORKOS_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Timeout for the refresh HTTP request (15 seconds). */
export const WORKOS_REFRESH_TIMEOUT_MS = 15_000;

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

// ─── Token Refresh ─────────────────────────────────────────────────────────

/** Options for refreshing a WorkOS token. All I/O is injectable for testability. */
export interface WorkosRefreshOptions {
  /** Override the global fetch (for testing). */
  fetch?: typeof globalThis.fetch;
  /** Override the API base URL (defaults to resolveApiBase()). */
  apiBase?: string;
}

/**
 * Build OAuthCredentials from WorkOS token components.
 * @internal
 */
export function credentialsFromWorkos(
  accessToken: string,
  rtToken: string,
  expiresAt: number,
): OAuthCredentials {
  return {
    access: accessToken,
    refresh: rtToken,
    expires: expiresAt,
  };
}

/**
 * Refresh a WorkOS OAuth access token via Cline's server-side refresh endpoint.
 *
 * Cline's `/api/v1/auth/refresh` accepts `{ granttype: "refresh_token",
 * refreshToken: "..." }` and returns `{ data: { accessToken, refreshToken } }`.
 * The new access token requires the "workos:" prefix when used as a Bearer
 * token, so we add it if the API returns a bare JWT.
 *
 * @param credentials The current OAuth credentials (refresh token used)
 * @param options Injectable fetch and apiBase for testing
 * @returns New OAuthCredentials with a fresh access token
 */
export async function refreshWorkosToken(
  credentials: OAuthCredentials,
  options: WorkosRefreshOptions = {},
): Promise<OAuthCredentials> {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const apiBase = options.apiBase ?? resolveApiBase();

  let response;
  try {
    response = await fetchFn(`${apiBase}${CLINE_REFRESH_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        granttype: "refresh_token",
        refreshToken: credentials.refresh,
      }),
      signal: AbortSignal.timeout(WORKOS_REFRESH_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        "ClinePass token refresh timed out — check your network or try a static API key.",
        { cause: err },
      );
    }
    throw err;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown error");
    throw new Error(
      `ClinePass token refresh failed (${response.status}): ${text}` +
        " — try running `cline auth` to re-login, or use a static API key.",
    );
  }

  const data = (await response.json()) as {
    data?: { accessToken?: string; refreshToken?: string };
    accessToken?: string;
    refreshToken?: string;
  };

  // The response is { data: { accessToken, refreshToken } } or flat
  const tokens = data.data ?? data;
  const newAccessToken = tokens.accessToken;
  const newRefreshToken = tokens.refreshToken;

  if (!newAccessToken || !newRefreshToken) {
    throw new Error("ClinePass token refresh returned unexpected response format");
  }

  // Ensure the workos: prefix is present (the refresh endpoint may return
  // a bare JWT without it, but the chat API requires it)
  const prefixedToken = isWorkosToken(newAccessToken) ? newAccessToken : `workos:${newAccessToken}`;

  return credentialsFromWorkos(
    prefixedToken,
    newRefreshToken,
    Date.now() + WORKOS_TOKEN_LIFETIME_MS - WORKOS_REFRESH_MARGIN_MS,
  );
}

// ─── Credential Extraction ─────────────────────────────────────────────────

/**
 * Resolve a credential's expiry timestamp.
 *
 * Returns the field as-is when it's a finite number. For missing or invalid
 * expiry, returns 0 (treats the credential as stale) rather than a synthetic
 * future time — this ensures `pickFreshestAuth` does not rank unknown-expiry
 * credentials above known ones, and `loginWithWorkosCredentials` refreshes
 * before use. (Returning `Date.now() + lifetime` here would let a stale token
 * with no expiry outrank a known-expired-but-refreshable one and skip refresh.)
 */
function resolveExpiresAt(expiresField: unknown): number {
  if (typeof expiresField === "number" && Number.isFinite(expiresField)) {
    return expiresField;
  }
  return 0;
}

/** Parse a Cline CLI `settings.auth` block into WorkOS credentials. */
function extractWorkosAuthFromRecord(
  auth: Record<string, unknown>,
): ClineAuthCredentials | undefined {
  const accessToken = stringValue(auth.accessToken);
  const refreshToken = stringValue(auth.refreshToken);
  if (!accessToken || !refreshToken || !isWorkosToken(accessToken)) return undefined;

  return {
    accessToken,
    refreshToken,
    expiresAt: resolveExpiresAt(auth.expiresAt),
  };
}

/** Parse pi `auth.json` `clinepass` OAuth credentials. */
function extractPiClinepassAuth(parsed: Record<string, unknown>): ClineAuthCredentials | undefined {
  const cpField = parsed.clinepass;
  if (!isRecord(cpField)) return undefined;

  const accessToken = stringValue(cpField.access);
  const refreshToken = stringValue(cpField.refresh);
  if (!accessToken || !refreshToken || !isWorkosToken(accessToken)) return undefined;

  return {
    accessToken,
    refreshToken,
    expiresAt: resolveExpiresAt(cpField.expires),
  };
}

/** Collect WorkOS credentials from every Cline CLI provider entry. */
function collectClineProviderAuths(parsed: Record<string, unknown>): ClineAuthCredentials[] {
  const providers = isRecord(parsed.providers) ? parsed.providers : undefined;
  if (!providers) return [];

  const results: ClineAuthCredentials[] = [];
  for (const key of ["cline-pass", "cline"]) {
    const provider = isRecord(providers[key]) ? providers[key] : undefined;
    if (!provider) continue;
    const settings = isRecord(provider.settings) ? provider.settings : undefined;
    if (!settings) continue;
    const auth = isRecord(settings.auth) ? settings.auth : undefined;
    if (!auth) continue;
    const cred = extractWorkosAuthFromRecord(auth);
    if (cred) results.push(cred);
  }
  return results;
}

function pickFreshestAuth(candidates: ClineAuthCredentials[]): ClineAuthCredentials | undefined {
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, current) =>
    current.expiresAt > best.expiresAt ? current : best,
  );
}

/**
 * Extract WorkOS OAuth credentials from all known auth stores.
 *
 * Scans `~/.cline/data/settings/providers.json` and `~/.pi/agent/auth.json`,
 * collecting every WorkOS candidate (pi `clinepass` OAuth, `cline-pass`, and
 * `cline` CLI providers) and returning the one with the latest `expiresAt`.
 *
 * Note: the accessToken may be expired — callers should refresh via
 * Cline's /api/v1/auth/refresh endpoint before use.
 */
export function resolveClineAuthCredentials(
  options: AuthKeyOptions = {},
): ClineAuthCredentials | undefined {
  const candidates: ClineAuthCredentials[] = [];

  walkAuthPaths(options, (parsed) => {
    const piAuth = extractPiClinepassAuth(parsed);
    if (piAuth) candidates.push(piAuth);
    candidates.push(...collectClineProviderAuths(parsed));
    return undefined;
  });

  return pickFreshestAuth(candidates);
}
