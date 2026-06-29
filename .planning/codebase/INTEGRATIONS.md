# INTEGRATIONS.md — External Integrations

## ClinePass API (Primary)

| Aspect      | Value                                                              |
| ----------- | ------------------------------------------------------------------ |
| Base URL    | `https://api.cline.bot` (overridable via `CLINE_API_BASE` env var) |
| API format  | OpenAI-compatible Chat Completions                                 |
| Auth method | Bearer token (static API key or WorkOS OAuth access token)         |
| Protocol    | HTTPS, SSE streaming                                               |

### Endpoints Used

| Endpoint                   | Method | Purpose                                                            |
| -------------------------- | ------ | ------------------------------------------------------------------ |
| `/api/v1/chat/completions` | POST   | LLM chat completions (streaming via pi's `openai-completions` API) |
| `/api/v1/auth/refresh`     | POST   | WorkOS OAuth token refresh                                         |
| `/api/v1/models`           | GET    | Dynamic model discovery (currently 404, falls back to static list) |

### Auth Credentials Flow

```
Priority order:
1. CLINE_API_KEY env var
2. ~/.cline/data/settings/providers.json → providers["cline-pass"].settings.apiKey
3. ~/.cline/data/settings/providers.json → providers["cline"].settings.apiKey
4. ~/.pi/agent/auth.json → apiKey field
5. ~/.pi/agent/auth.json → clinepass field (string or {access: "..."})
```

WorkOS OAuth tokens (prefixed `workos:`) are **not** used as static keys — they're handled via the OAuth refresh flow in `src/oauth.ts`. The HTTP protocol (endpoint, body format, prefix enforcement) lives in `src/workos.ts`; `src/oauth.ts` is pure orchestration (login flow + dispatch).

## Cline CLI (Credential Reuse)

| Aspect      | Value                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Config path | `~/.cline/data/settings/providers.json`                                                                   |
| Format      | Nested: `{providers: {"cline-pass": {settings: {apiKey, auth: {accessToken, refreshToken, expiresAt}}}}}` |
| Purpose     | Reuse existing Cline CLI login for WorkOS OAuth credentials                                               |

The extension reads both `cline-pass` and `cline` provider entries from the Cline CLI's config, preferring `cline-pass`.

## WorkOS OAuth (via Cline)

| Aspect                | Value                                                                                |
| --------------------- | ------------------------------------------------------------------------------------ |
| Token prefix          | `workos:` (e.g., `workos:eyJhbGci...`)                                               |
| Access token lifetime | ~1 hour (conservatively estimated at 55 minutes)                                     |
| Refresh margin        | 5 minutes before expiry                                                              |
| Refresh endpoint      | `POST /api/v1/auth/refresh` with `{granttype: "refresh_token", refreshToken: "..."}` |
| Response format       | `{data: {accessToken, refreshToken}}` or flat `{accessToken, refreshToken}`          |
| Token rotation        | Each refresh returns a new `refreshToken` (single-use)                               |

### WorkOS Token Refresh Flow

```
1. Detect WorkOS credentials from Cline CLI config (workos.ts: resolveClineAuthCredentials)
2. Check if accessToken is expired (expiresAt <= now + 5min margin)
3. If expired: POST /api/v1/auth/refresh → get new accessToken + refreshToken (workos.ts: refreshWorkosToken)
4. Ensure "workos:" prefix on new accessToken (workos.ts)
5. Return OAuthCredentials to pi for persistence
```

The HTTP refresh protocol (endpoint URL, `{granttype, refreshToken}` body format, response parsing, prefix enforcement) is encapsulated in `src/workos.ts`. The `oauth.ts` module imports `refreshWorkosToken` and calls it — it has no knowledge of the refresh protocol details.

## pi Extension API

| Aspect         | Value                                              |
| -------------- | -------------------------------------------------- |
| Package        | `@earendil-works/pi-coding-agent`                  |
| Interface      | `ExtensionAPI`                                     |
| Entry point    | `export default async function (pi: ExtensionAPI)` |
| Registration   | `pi.registerProvider(name, config)`                |
| Event handling | `pi.on("message_end", handler)`                    |

### ProviderConfig Fields Used

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| `name`       | `"ClinePass"`                             |
| `baseUrl`    | `${apiBase}/api/v1`                       |
| `apiKey`     | `$CLINE_API_KEY` (env var interpolation)  |
| `api`        | `"openai-completions"`                    |
| `authHeader` | `true`                                    |
| `oauth`      | `{name, login, refreshToken, getApiKey}`  |
| `models`     | Dynamic from API or static `MODELS` array |

## Cline Dashboard (Manual Login)

| Aspect  | Value                                                          |
| ------- | -------------------------------------------------------------- |
| URL     | `https://app.cline.bot/settings/api-keys`                      |
| Purpose | Fallback login flow — user creates and pastes a static API key |

When no Cline CLI credentials are detected, the `/login` flow opens this URL and prompts the user to paste an API key.
