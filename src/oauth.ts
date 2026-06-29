/**
 * ClinePass login provider for pi's /login flow.
 *
 * Supports two authentication methods:
 *
 * 1. **WorkOS OAuth (automatic)** — if the user is already signed in with the
 *    Cline CLI (`cline auth`), the Cline CLI stores WorkOS OAuth credentials at
 *    `~/.cline/data/settings/providers.json`. We reuse those credentials and
 *    refresh the short-lived access token (~1 hour) via Cline's server-side
 *    endpoint `/api/v1/auth/refresh`. No separate API key required.
 *
 * 2. **Static API key (manual)** — long-lived bearer tokens created from the
 *    Cline dashboard (app.cline.bot → Settings → API Keys). The user pastes
 *    the key during `/login` and it never expires.
 *
 * The login flow checks for existing Cline CLI WorkOS credentials first; if
 * found, the user is logged in automatically. Otherwise, it falls back to the
 * browser-assisted manual paste flow.
 */

import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import { sanitizeApiKey, resolveApiBase } from "./env.js";
import {
  resolveClineAuthCredentials,
  isWorkosToken,
  CLINE_REFRESH_ENDPOINT,
  WORKOS_TOKEN_LIFETIME_MS,
  WORKOS_REFRESH_MARGIN_MS,
} from "./workos.js";

const DASHBOARD_URL = "https://app.cline.bot/settings/api-keys";
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000; // API keys don't expire

// ─── Static API key helpers ──────────────────────────────────────────────────

function credentialsFromApiKey(apiKey: string): OAuthCredentials {
  return {
    refresh: apiKey,
    access: apiKey,
    expires: Date.now() + TEN_YEARS_MS,
  };
}

// ─── WorkOS OAuth helpers ────────────────────────────────────────────────────

function credentialsFromWorkos(
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
 */
export async function refreshWorkosToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  const apiBase = resolveApiBase();
  const response = await fetch(`${apiBase}${CLINE_REFRESH_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      granttype: "refresh_token",
      refreshToken: credentials.refresh,
    }),
  });

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

// ─── Login flow ─────────────────────────────────────────────────────────────

/**
 * Start the ClinePass login flow.
 *
 * First checks for existing WorkOS OAuth credentials from the Cline CLI
 * (`~/.cline/data/settings/providers.json`). If found, the user is logged in
 * automatically — no manual paste required.
 *
 * If no Cline CLI credentials are found, falls back to the manual paste flow:
 * opens the Cline API Keys dashboard so the user can create a key, then
 * prompts them to paste it back.
 */
export async function login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  // Try to reuse existing Cline CLI WorkOS credentials
  const clineAuth = resolveClineAuthCredentials();
  if (clineAuth) {
    // No browser navigation needed — credentials are auto-detected from the
    // Cline CLI's local config. Skip onAuth so no browser window opens.

    // If the token is already expired, refresh it immediately
    if (clineAuth.expiresAt <= Date.now() + WORKOS_REFRESH_MARGIN_MS) {
      const tempCred = credentialsFromWorkos(
        clineAuth.accessToken,
        clineAuth.refreshToken,
        clineAuth.expiresAt,
      );
      return refreshWorkosToken(tempCred);
    }

    return credentialsFromWorkos(
      clineAuth.accessToken,
      clineAuth.refreshToken,
      clineAuth.expiresAt,
    );
  }

  // Fall back to manual API key paste
  callbacks.onAuth({ url: DASHBOARD_URL });

  const apiKey = sanitizeApiKey(
    await callbacks.onPrompt({
      message:
        "No Cline CLI login detected. Paste your ClinePass API key " +
        "(create one at the dashboard that just opened, under Settings → API Keys, " +
        "or run `cline auth` first to use your Cline subscription):",
    }),
  );

  if (!apiKey) throw new Error("No ClinePass API key provided");

  // Lightweight format heuristic: Cline API keys are opaque strings, typically
  // 20+ chars. Warn (don't block) on suspiciously short or whitespace-only input
  // so users catch paste errors at login time rather than at first request.
  if (apiKey.length < 20) {
    console.warn(
      `[clinepass] Warning: API key looks unusually short (${apiKey.length} chars). ` +
        "Verify you copied the full key from app.cline.bot → Settings → API Keys.",
    );
  }

  return credentialsFromApiKey(apiKey);
}

/**
 * Refresh ClinePass credentials.
 *
 * For WorkOS OAuth tokens (detected by the "workos:" prefix), calls Cline's
 * server-side refresh endpoint to get a new short-lived access token.
 *
 * For static API keys, this is a no-op (keys don't expire).
 */
export async function refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  // WorkOS access tokens have the "workos:" prefix; static API keys don't.
  // We check the access token (not the refresh token) because WorkOS refresh
  // tokens are opaque strings without the prefix.
  if (isWorkosToken(credentials.access)) {
    return refreshWorkosToken(credentials);
  }
  return credentialsFromApiKey(credentials.refresh);
}

/**
 * Returns the access token (API key or WorkOS OAuth token) from credentials.
 */
export function getApiKey(credentials: OAuthCredentials): string {
  return credentials.access;
}
