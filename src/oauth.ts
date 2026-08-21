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
import { sanitizeApiKey } from "./env.js";
import {
  resolveClineAuthCredentials,
  isWorkosToken,
  refreshWorkosToken,
  credentialsFromWorkos,
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

async function loginWithManualApiKey(
  callbacks: OAuthLoginCallbacks,
  reason?: string,
): Promise<OAuthCredentials> {
  callbacks.onAuth({ url: DASHBOARD_URL });

  const apiKey = sanitizeApiKey(
    await callbacks.onPrompt({
      message:
        (reason ? `${reason} ` : "No Cline CLI login detected. ") +
        "Paste your ClinePass API key " +
        "(create one at the dashboard that just opened, under Settings → API Keys, " +
        "or run `cline auth` first to use your Cline subscription):",
    }),
  );

  if (!apiKey) throw new Error("No ClinePass API key provided");

  if (apiKey.length < 20) {
    console.warn(
      `[clinepass] Warning: API key looks unusually short (${apiKey.length} chars). ` +
        "Verify you copied the full key from app.cline.bot → Settings → API Keys.",
    );
  }

  return credentialsFromApiKey(apiKey);
}

async function loginWithWorkosCredentials(
  clineAuth: NonNullable<ReturnType<typeof resolveClineAuthCredentials>>,
): Promise<OAuthCredentials> {
  if (clineAuth.expiresAt <= Date.now() + WORKOS_REFRESH_MARGIN_MS) {
    const tempCred = credentialsFromWorkos(
      clineAuth.accessToken,
      clineAuth.refreshToken,
      clineAuth.expiresAt,
    );
    return refreshWorkosToken(tempCred);
  }

  return credentialsFromWorkos(clineAuth.accessToken, clineAuth.refreshToken, clineAuth.expiresAt);
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
  const clineAuth = resolveClineAuthCredentials();
  if (clineAuth) {
    try {
      return await loginWithWorkosCredentials(clineAuth);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[clinepass] WorkOS auto-login failed: ${message}`);
      return loginWithManualApiKey(
        callbacks,
        "Cline subscription login failed (refresh token may be expired or network is unreachable).",
      );
    }
  }

  return loginWithManualApiKey(callbacks);
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
