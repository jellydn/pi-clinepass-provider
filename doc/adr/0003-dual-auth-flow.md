# 3. Dual auth flow: WorkOS OAuth and static API keys

Date: 2026-06-30

## Status

Accepted

## Context

ClinePass supports two authentication mechanisms:

1. **Static API keys** — long-lived bearer tokens created from the Cline dashboard (app.cline.bot → Settings → API Keys). Users paste these during `/login`.
2. **WorkOS OAuth tokens** — short-lived (~1 hour) access tokens managed by the Cline CLI (`cline auth`). Stored in `~/.cline/data/settings/providers.json` as nested JSON.

Additionally, pi's OAuth framework expects a `login` function returning `OAuthCredentials` (with `access`, `refresh`, and `expires` fields) and a `refreshToken` function for credential renewal. We needed a single `login` flow that handles both auth paths transparently.

Two other options were considered:

- **Only static API keys** — simpler but forces Cline CLI users to find and paste their API key.
- **Only WorkOS OAuth** — forces non-CLI users to install and authenticate with the Cline CLI first.

## Decision

Implement a two-path login flow in `src/oauth.ts` that auto-detects existing Cline CLI WorkOS credentials as the primary path, falling back to browser-assisted API key paste.

The `login()` function:

1. Calls `resolveClineAuthCredentials()` to check for existing WorkOS credentials.
2. If found, returns `OAuthCredentials` using the WorkOS refresh token. If the access token is near expiry, refreshes it immediately.
3. If not found, opens the Cline API Keys dashboard URL via `callbacks.onAuth()` and prompts the user to paste their key via `callbacks.onPrompt()`.

The `refreshToken()` function checks whether the credential uses WorkOS (detected by the `workos:` prefix on the access token) or a static key:

- WorkOS tokens → calls Cline's server-side refresh endpoint.
- Static keys → returns as-is (they don't expire).

## Consequences

### 📋 Positive

- **Zero-config for Cline CLI users** — if `cline auth` has been run, the provider picks up credentials automatically. No browser, no paste, no env vars.
- **Single mental model** — users always run `pi /login` and select "ClinePass", regardless of which auth method they use.
- **Graceful degradation** — if Cline CLI is not installed or never configured, the user still has a clear manual path.
- **Safe mismatch detection** — a short key (<20 chars) triggers a warning at login time (not at first request), catching paste errors early without blocking the user.

### 📋 Negative

- **Duplicate auth stores** — credentials live in two possible locations (`~/.cline/data/settings/providers.json` and `~/.pi/agent/auth.json`), which could drift over time.
- **Side effect in login** — calling `/api/v1/auth/refresh` consumes the old refresh token (single-use rotation). If the pi session crashes mid-flow, the user's Cline CLI auth state may become invalid, requiring `cline auth` to re-authenticate.
