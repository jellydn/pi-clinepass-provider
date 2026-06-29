# INTEGRATIONS.md — External Integrations

## 1. ClinePass Chat API

| Attribute | Detail |
|-----------|--------|
| **Provider** | Cline (cline.bot) |
| **Base URL** | `https://api.cline.bot` (overridable via `CLINE_API_BASE` env var) |
| **Endpoint** | `/api/v1/chat/completions` |
| **Protocol** | OpenAI-compatible Chat Completions API |
| **Auth** | Bearer token (API key or WorkOS access token prefixed with `workos:`) |
| **Code location** | `src/env.ts` (constants), `src/index.ts` (registration) |
| **Fallback** | None — API is the core data path |

pi uses its built-in `openai-completions` streaming handler, so no custom stream parser is needed.

### Override Mechanism

Set `CLINE_API_BASE` env var to point to a different endpoint (e.g., staging). The value is trimmed, empty values are ignored, and trailing slashes are stripped.

## 2. ClinePass Model Discovery API

| Attribute | Detail |
|-----------|--------|
| **Endpoint** | `/api/v1/models` |
| **Protocol** | OpenAI-compatible model list (`{ data: [{ id, ... }] }` or bare array) |
| **Timeout** | 5 seconds (`AbortController` with `AbortSignal.timeout`) |
| **Code location** | `src/models.ts` |
| **Fallback** | Static `MODELS` array (10 curated models) |
| **Behavior** | Currently returns 404 — code falls back to static models gracefully |

The dynamic discovery path is forward-compatible: when Cline enables the `/models` endpoint, the extension will automatically pick up new models without a code change.

## 3. WorkOS OAuth (via Cline CLI)

| Attribute | Detail |
|-----------|--------|
| **Provider** | WorkOS (via Cline's infrastructure) |
| **Token prefix** | `workos:` |
| **Token lifetime** | ~1 hour |
| **Refresh margin** | 5 minutes before expiry |
| **Refresh endpoint** | `/api/v1/auth/refresh` |
| **Refresh body** | `{ granttype: "refresh_token", refreshToken: "..." }` |
| **Refresh response** | `{ data: { accessToken, refreshToken } }` |
| **Code location** | `src/workos.ts` (extraction + refresh), `src/oauth.ts` (login flow), `src/auth.ts` (guard) |
| **Credential source** | `~/.cline/data/settings/providers.json` (providers["cline-pass"] or providers["cline"]) |

### Token Flow

1. **Extraction**: `resolveClineAuthCredentials()` reads WorkOS tokens from Cline CLI's local config
2. **Login**: `login()` auto-detects Cline CLI credentials; refreshes if expired; falls back to manual API key paste
3. **Refresh**: `refreshToken()` detects `workos:` prefix and delegates to `refreshWorkosToken()`
4. **Guard**: `resolveApiKey()` skips `workos:`-prefixed tokens in the pi `auth.json` path (they are short-lived and should not be returned as static keys)

## 4. pi Runtime

| Attribute | Detail |
|-----------|--------|
| **Entry point** | `ExtensionAPI` received via default export in `src/index.ts` |
| **Registration** | `pi.registerProvider()` with name, base URL, API key reference, OAuth hooks, and models |
| **Error surface** | `pi.on("message_end", handler)` for ClinePass-specific error messages |
| **OAuth hooks** | `login()`, `refreshToken()`, `getApiKey()` |
| **Code location** | `src/index.ts` |

## 5. npm

| Attribute | Detail |
|-----------|--------|
| **Registry** | npm (public) |
| **Package name** | `pi-clinepass-provider` |
| **Install command** | `pi install npm:pi-clinepass-provider` |
| **Publish** | `npm run pub` (wraps `npm publish`) |

## 6. Cline Dashboard

| Attribute | Detail |
|-----------|--------|
| **URL** | `https://app.cline.bot/settings/api-keys` |
| **Purpose** | Manual API key creation (browser-assisted paste during `/login`) |
| **Code location** | `src/oauth.ts` (`DASHBOARD_URL` constant) |

## No Other Integrations

The extension does **not** integrate with:
- External databases
- Third-party auth providers (WorkOS is via Cline, not direct)
- Webhooks or event systems
- Caching layers
- Monitoring or analytics services
