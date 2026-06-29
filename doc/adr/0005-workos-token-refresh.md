# 5. WorkOS OAuth token refresh with rotation

Date: 2026-06-30

## Status

Accepted

## Context

Cline CLI uses WorkOS for authentication, which issues short-lived access tokens (~1 hour) and refresh tokens that are single-use (rotated on each refresh). When the pi provider reuses Cline CLI credentials, it must:

1. Detect when the access token is about to expire (before pi's API call fails with a 401).
2. Call Cline's server-side endpoint `/api/v1/auth/refresh` to get a new access+refresh token pair.
3. Ensure the access token has the `workos:` prefix that the Cline chat API requires.

The Cline refresh endpoint accepts a non-standard body: `{ granttype: "refresh_token", refreshToken: "..." }` (note: `granttype` has no underscore, unlike the OAuth standard `grant_type`). The response has a nested format: `{ data: { accessToken, refreshToken } }` or a flat `{ accessToken, refreshToken }`.

## Decision

Implement a pro-active refresh strategy in `src/oauth.ts` with a 5-minute margin before expiry, and handle the non-standard API format explicitly.

Key design choices:

- **Refresh margin** — `WORKOS_REFRESH_MARGIN_MS = 5 min`. Refresh is triggered when `expiresAt <= Date.now() + margin`. This prevents expiry during a long conversation turn.
- **Token lifetime** — `WORKOS_TOKEN_LIFETIME_MS = 55 min`. Used as a fallback when `providers.json` doesn't include `expiresAt`.
- **Prefix enforcement** — after refresh, the `workos:` prefix is added if absent. The chat API requires it, but the refresh endpoint may return a bare JWT.
- **Single-use rotation awareness** — each refresh consumes the old refresh token. A crash mid-flow invalidates the Cline CLI's stored auth state, requiring re-login via `cline auth`.
- **Response format handling** — handles both `{ data: { accessToken, ... } }` and flat `{ accessToken, ... }` to be resilient to API changes.

## Consequences

### 📋 Positive

- **Seamless long sessions** — the 5-minute refresh margin means tokens are always valid during active use. Users never see a 401 mid-conversation.
- **No stored token drift** — the refresh is entirely at the OAuth level (pi's `refreshToken` callback). No local file updates are needed — pi manages credential storage internally.
- **Optimistic prefix handling** — adding `workos:` if missing means the provider works even if the API changes its response format.

### 📋 Negative

- **Non-standard API format** — the `granttype` field (no underscore) deviates from OAuth 2.0 conventions. If Cline normalises this in the future, the provider will need an update.
- **Token rotation fragility** — single-use refresh tokens mean that a failed refresh (network error, crash) invalidates the existing refresh token. The user must re-run `cline auth` to recover.
- **Hardcoded expiry fallback** — if `providers.json` is missing the `expiresAt` field, the provider assumes a 55-minute lifetime from the current time, which may be inaccurate and trigger premature or delayed refreshes.
