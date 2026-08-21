# External Integrations

**Analysis Date:** 2026-07-06

## APIs & External Services

**ClinePass Chat API (OpenAI-compatible):**

- Service: Cline's `/api/v1/chat/completions` endpoint, base `https://api.cline.bot` (overridable via `CLINE_API_BASE`).
- Purpose: Streaming chat completions for curated open-weight coding models (GLM-5.2, Kimi K2.7, DeepSeek V4, etc.). ClinePass is a $9.99/mo subscription gateway, not a model provider itself.
- SDK/Client: None — pi's built-in `openai-completions` streaming handles SSE + tool calls + usage. The extension registers `api: "openai-completions"` and `authHeader: true`; no custom `streamSimple`.
- Auth: `Authorization: Bearer <key>` header. Key resolved by `src/auth.ts` `resolveApiKey` (provided key → `CLINE_API_KEY` env → auth files). Sigil `$CLINE_API_KEY` passed to `pi.registerProvider` so pi injects the env var at request time.

**Cline Models API (dynamic discovery):**

- Service: `GET /api/v1/models` (OpenAI-compatible `{ data: [...] }` or bare array).
- Purpose: Fetch the live model list at extension startup. Only models with `cline-pass/`-prefixed IDs are kept.
- SDK/Client: `globalThis.fetch` (injectable via `RemoteModelsOptions.fetch`).
- Auth: `Authorization: Bearer <apiKey>` when an API key is available.
- Resilience: 5s timeout (`MODELS_FETCH_TIMEOUT_MS`); returns `undefined` on any error (network, non-OK, parse, empty) → falls back to the static `MODELS` array in `src/models.ts`. **Note:** the endpoint currently returns 404, so static fallback is the live path today.

**Cline Auth Refresh (WorkOS OAuth):**

- Service: `POST /api/v1/auth/refresh`.
- Purpose: Exchange a WorkOS refresh token for a new short-lived access token (~1h) + rotated refresh token.
- Request body: `{ "granttype": "refresh_token", "refreshToken": "<rt>" }` — **note `granttype` has no underscore** (Cline-specific quirk, see ADR-0005).
- Response: `{ data: { accessToken, refreshToken } }` or flat `{ accessToken, refreshToken }`.
- SDK/Client: `globalThis.fetch` (injectable via `WorkosRefreshOptions.fetch`), 15s timeout via `AbortSignal.timeout`.
- Auth: None on this endpoint (the refresh token is the credential).
- Gotcha: The returned access token may be a bare JWT — the `workos:` prefix is added if missing (`src/workos.ts` `refreshWorkosToken`). Refresh tokens are single-use and rotated on each call.

## Data Storage

**Databases:**

- None. No database, no ORM.

**File Storage:**

- Local filesystem only — reads (never writes) two credential stores:
  - `~/.cline/data/settings/providers.json` — Cline CLI nested format: `providers["cline-pass"|"cline"].settings.{apiKey | auth.{accessToken,refreshToken,expiresAt}}`.
  - `~/.pi/agent/auth.json` — pi OAuth format: `{apiKey}` | `{clinepass: "..."}` | `{clinepass: {access, refresh, expires}}`.
- Writes: pi itself persists OAuth credentials to `~/.pi/agent/auth.json` after `/login`; the extension only reads.

**Caching:**

- None. Model list is fetched once at startup; no in-memory cache beyond the registered models.

## Authentication & Identity

**Auth Provider:** WorkOS (via Cline's OAuth flow) + Cline static API keys (dual auth).

- Implementation: `src/oauth.ts` (orchestration) + `src/workos.ts` (protocol adapter). Two paths:
  1. **WorkOS OAuth (automatic)** — if the user ran `cline auth`, reuse WorkOS credentials from `~/.cline/data/settings/providers.json`; refresh via Cline's `/api/v1/auth/refresh`. Tokens prefixed `workos:`.
  2. **Static API key (manual)** — long-lived bearer token from `app.cline.bot → Settings → API Keys`; pasted during `pi /login` if no Cline CLI login is found. Treated as 10-year expiry.
- `refreshToken()` auto-detects WorkOS vs static by checking the `workos:` prefix on `credentials.access`.
- Token sanitization (`src/env.ts` `sanitizeApiKey`): strips terminal bracketed-paste wrappers (`\x1b[200~`/`[201~`) and control chars from pasted keys.

## Monitoring & Observability

**Error Tracking:**

- None (no Sentry/external). Errors surface through pi's UI.

**Logs:**

- `console.warn` / `console.error` with `[clinepass]` prefix. Used for: corrupt auth files, short API keys, WorkOS auto-login failures, and the no-UI fallback in `handleClinePassError`. **Never logs file contents or resolved keys.**

## CI/CD & Deployment

**Hosting:**

- npm registry (`npm publish`). The package is consumed by pi installations; no hosting infrastructure.

**CI Pipeline:**

- GitHub Actions, `.github/workflows/ci.yml`.
- `test` job: 3-matrix (latest+Node22, min-pi-0.80.2+Node22, latest+Node24). Runs `npm ci`, optional pi-version pin, `lint`, `typecheck`, `format:check`, `npm test`. Triggered on push/PR to `main`.
- `e2e` job: runs only on `workflow_dispatch` with `run_e2e=true` + `CLINE_API_KEY` secret. Installs pi globally and runs `tests/e2e/smoke.sh`.
- Dependency updates: Renovate (`renovate.json`).

## Environment Configuration

**Required env vars:**

- `CLINE_API_KEY` — required for non-`/login` usage unless credentials exist in the auth files. (Strictly optional if WorkOS creds are present, but needed for dynamic model discovery and static-key auth.)

**Optional env vars:**

- `CLINE_API_BASE` — override API endpoint (default `https://api.cline.bot`).

**Secrets location:**

- `CLINE_API_KEY` in the shell environment, or in `~/.cline/data/settings/providers.json` / `~/.pi/agent/auth.json`. CI uses `secrets.CLINE_API_KEY` (E2E only).

## Webhooks & Callbacks

**Incoming:**

- None.

**Outgoing:**

- `pi.on("message_end", handleClinePassError)` — the extension subscribes to pi's `message_end` event to classify and surface ClinePass errors (403/401/429). Not a webhook; an in-process event subscription.

---

_Integration audit: 2026-07-06_
