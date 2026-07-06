# Architecture

**Analysis Date:** 2026-07-06

## Pattern Overview

**Overall:** pi extension module with dependency-injected pure-logic core (IoC separation).

**Key Characteristics:**

- Single entry point (default export) receives pi's `ExtensionAPI` and registers one provider.
- Pure logic separated from I/O via injectable options objects (`AuthKeyOptions`, `RemoteModelsOptions`, `WorkosRefreshOptions`) — every function is testable without touching the filesystem or network.
- Deep modules with simple interfaces: each module owns one concern; complexity hides behind a single exported function (e.g. `handleClinePassError`, `refreshWorkosToken`).
- No circular dependencies. Dependency graph flows one direction (see Layers).
- No build step — pi loads `.ts` directly; `tsconfig.json` is `noEmit`.

## Layers

**Entry / Wiring (`src/index.ts`):**

- Purpose: Bootstraps the extension — resolves API base + key, discovers models, calls `pi.registerProvider`, subscribes to `message_end`.
- Location: `src/index.ts` (80 lines)
- Contains: The async default export; no business logic.
- Depends on: `env.ts`, `auth.ts`, `models.ts`, `error-handler.ts`, `oauth.ts`.
- Used by: pi runtime (loads the module).

**Environment & Constants (`src/env.ts`):**

- Purpose: Shared constants (`DEFAULT_API_BASE`, `ENV_API_KEY`, `PROVIDER_NAME`, `WORKOS_TOKEN_PREFIX`) and helpers (`resolveApiBase`, `sanitizeApiKey`, `buildEndpointUrl`).
- Location: `src/env.ts` (58 lines)
- Depends on: `utils.ts`.

**Type Guards (`src/utils.ts`):**

- Purpose: Pure `unknown` → typed guards (`isRecord`, `stringValue`, `numberValue`, `booleanValue`) used at every I/O boundary.
- Location: `src/utils.ts` (27 lines) — leaf dependency, no src/ imports.

**Models (`src/models.ts`):**

- Purpose: Static `MODELS` catalog + dynamic discovery (`fetchRemoteModels`, `resolveModels`). Per-model `thinkingLevelMap` maps pi's 6 thinking levels to ClinePass `reasoning_effort`.
- Location: `src/models.ts` (412 lines — largest module)
- Depends on: `env.ts`, `utils.ts`.

**Auth (`src/auth.ts`):**

- Purpose: Static API key resolution + shared file-walking helpers (`walkAuthPaths`, `walkClineProviderSettings`) reused by `workos.ts`.
- Location: `src/auth.ts` (166 lines)
- Depends on: `env.ts`, `utils.ts`.

**WorkOS Protocol (`src/workos.ts`):**

- Purpose: Sole owner of WorkOS-specific knowledge — token prefix detection, credential extraction, HTTP refresh protocol, credential construction, constants.
- Location: `src/workos.ts` (247 lines)
- Depends on: `env.ts`, `utils.ts`, `auth.ts`.

**OAuth Orchestration (`src/oauth.ts`):**

- Purpose: Pure orchestration of the `/login` flow — WorkOS auto-login first, manual API-key paste fallback; `refreshToken` dispatches WorkOS vs static.
- Location: `src/oauth.ts` (141 lines)
- Depends on: `env.ts`, `workos.ts`. No HTTP/protocol details leak here (ADR-0006).

**Errors (`src/errors.ts`):**

- Purpose: Pure error classification (`classifyClinePassError`) + friendly message table. No src/ dependencies.
- Location: `src/errors.ts` (53 lines)

**Error Handler (`src/error-handler.ts`):**

- Purpose: Owns the error surface pipeline — Filter → Classify (delegates to `errors.ts`) → Deliver (`ui.notify` or `console.error`).
- Location: `src/error-handler.ts` (50 lines)
- Depends on: `errors.ts`, `env.ts`.

**Dependency graph:** `utils → env → {models, auth, workos → auth}`, with `errors` and `error-handler` as downstream consumers. `index.ts` and `oauth.ts` are the composition roots.

## Data Flow

**Extension startup:**

1. pi loads `src/index.ts`, calls the default export with `ExtensionAPI`.
2. `resolveApiBase()` reads `CLINE_API_BASE` (or default).
3. `resolveApiKey()` resolves the key (provided → env → auth files).
4. `resolveModels(apiKey, {apiBase})` fetches `/api/v1/models` (5s timeout); on any failure falls back to static `MODELS`.
5. `pi.registerProvider("clinepass", { baseUrl, apiKey: "$CLINE_API_KEY", api: "openai-completions", authHeader, oauth, models })` — pi now owns request streaming.
6. `pi.on("message_end", handleClinePassError)` — error handler subscribed.

**Chat request (runtime, owned by pi):**

1. User invokes a model `clinepass/cline-pass/<slug>`.
2. pi uses `openai-completions` to POST `${apiBase}/api/v1/chat/completions` with `Authorization: Bearer <resolved key>`, translating pi's thinking level via the model's `thinkingLevelMap`.
3. SSE streamed back through pi; on `message_end` with `stopReason: "error"`, `handleClinePassError` filters for the `clinepass` provider, classifies, and notifies the user.

**`/login` flow:**

1. `login(callbacks)` → `resolveClineAuthCredentials()` scans both auth stores for WorkOS creds, picks the freshest by `expiresAt`.
2. If found and not within 5-min refresh margin → return as-is. If near/expired → `refreshWorkosToken()` POSTs `/api/v1/auth/refresh`.
3. If WorkOS refresh fails (or no creds) → `loginWithManualApiKey` opens the dashboard URL and prompts for a paste; sanitizes; warns if < 20 chars.
4. Returns `OAuthCredentials`; pi persists to `~/.pi/agent/auth.json`.

**`refreshToken` (pi-driven, on token expiry):**

1. Inspect `credentials.access` for `workos:` prefix.
2. WorkOS → `refreshWorkosToken` (HTTP, prefix enforcement, rotation). Static → `credentialsFromApiKey` (no-op, 10-year expiry).

**State Management:**

- No in-extension state beyond the registered models. pi owns credential persistence and request state. The extension is stateless after registration.

## Key Abstractions

**`ModelConfig` + `thinkingLevelMap`:**

- Purpose: Declares a model's capabilities and the explicit mapping of pi's 6 thinking levels (`off|minimal|low|medium|high|xhigh`) to ClinePass `reasoning_effort` strings, or `null` (unsupported).
- Examples: `src/models.ts` (10 static models + `DEFAULT_THINKING_LEVEL_MAP` / `NO_THINKING_MAP` for remote models).
- Pattern: Readonly `Record<ThinkingLevel, string|null>` — every model must declare all six levels (no implicit defaults). `off` maps to `"none"` for models that can disable reasoning; `null` for always-reasoning models (Kimi).

**Injectable I/O options:**

- Purpose: Decouple pure logic from `node:fs`, `process.env`, `globalThis.fetch` for testing.
- Examples: `AuthKeyOptions` (`src/auth.ts`), `RemoteModelsOptions` (`src/models.ts`), `WorkosRefreshOptions` (`src/workos.ts`).
- Pattern: Optional functional fields defaulting to real implementations; tests pass mocks.

**`walkAuthPaths` / `walkClineProviderSettings`:**

- Purpose: Shared file-walking + provider-entry iteration used by both static-key (`auth.ts`) and WorkOS (`workos.ts`) extraction.
- Examples: `src/auth.ts`.
- Pattern: Higher-order extractor — caller supplies a `(parsed) => T | undefined` callback; helper handles try/catch, ENOENT suppression, and warning on corrupt files.

## Entry Points

**Default export (`src/index.ts`):**

- Location: `src/index.ts`
- Triggers: pi runtime loads the extension (via `pi.extensions` in `package.json` or `-e` flag).
- Responsibilities: Resolve config, discover models, register provider, subscribe error handler. Declared in `package.json` `main`/`types`/`pi.extensions`.

## Error Handling

**Strategy:** Three-stage pipeline owned by `error-handler.ts`: Filter → Classify → Deliver.

**Patterns:**

- **Filter:** `handleClinePassError` early-returns on non-error `stopReason`, missing `errorMessage`, or non-`clinepass` provider. Provider resolved as `msg.provider ?? ctx.model?.provider`.
- **Classify:** `classifyClinePassError` (pure, `errors.ts`) lowercases the message and matches patterns → `not_subscribed` (403/forbidden) | `auth_expired` (401/unauthorized) | `rate_limited` (429) | `unknown`. Each maps to an actionable user message in `CLINEPASS_ERROR_MESSAGES`.
- **Deliver:** `ctx.ui.notify(msg, "error")` when `ctx.hasUI`, else `console.error("[clinepass] ...")`.
- **Network resilience:** `fetchRemoteModels` and `refreshWorkosToken` swallow/translate errors — model discovery falls back to static; refresh throws typed messages with recovery hints ("try `cline auth` or a static API key"). Abort timeouts distinguished from other errors.
- **Auth-file reading:** ENOENT suppressed silently; corrupt files warned via `console.warn` (never logging contents).

## Cross-Cutting Concerns

**Logging:** `console.warn`/`console.error` with `[clinepass]` prefix. No logger framework. Security-conscious — never logs file contents or resolved keys.

**Validation:** `unknown` at every I/O boundary (JSON parse, API responses), guarded by `isRecord`/`stringValue`/`numberValue`/`booleanValue` before use. Strict TypeScript (`strict: true`, no unchecked indexed access). `tests/type/contract.ts` is a compile-time assertion against pi's `ExtensionAPI` contract.

**Authentication:** Dual auth (WorkOS OAuth + static key) with priority chain (provided → env → files). WorkOS tokens identified by `workos:` prefix (constant in `env.ts`, re-exported by `workos.ts` per ADR-0007). Token sanitization strips terminal paste artifacts.

---

_Architecture analysis: 2026-07-06_
