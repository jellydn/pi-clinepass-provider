# ARCHITECTURE.md — System Architecture

## Pattern

**pi Extension (Provider Plugin)** — a self-contained TypeScript module that registers a model provider with the pi coding agent. No server, no build step, no framework. Deep modules with injectable I/O, thin orchestration layer.

## Module Dependency Graph

```text
src/index.ts  (Extension entry point — thin orchestration)
  ├── src/error-handler.ts  (Error surface pipeline)
  │     └── src/errors.ts   (Pure error classification)
  ├── src/env.ts            (Constants, env helpers)
  ├── src/auth.ts           (API key resolution)
  ├── src/models.ts         (Model config + dynamic discovery)
  └── src/oauth.ts          (Login/refresh dispatch)
        ├── src/workos.ts   (WorkOS protocol adapter — token, refresh)
        ├── src/env.ts      (resolveApiBase)
        └── src/auth.ts     (resolveClineAuthCredentials)

src/utils.ts  (Shared type guards — leaf dependency, imported by env, models, auth, workos)
```

```text
tests/unit/
  ├── env.test.ts          (14 tests)
  ├── models.test.ts       (15 tests)
  ├── auth.test.ts         (15 tests)
  ├── workos.test.ts       (20 tests — includes refresh protocol tests)
  ├── errors.test.ts       (14 tests)
  ├── error-handler.test.ts (8 tests — calls handler directly, no extension bootstrap)
  ├── oauth.test.ts        (4 tests — dispatch only, protocol tests moved to workos)
  └── index.test.ts        (4 tests — registration + listener registration only)
```

## Layer Separation

### Layer 0: Shared Utilities (`src/utils.ts`)

- Pure type guard functions: `isRecord()`, `stringValue()`, `numberValue()`, `booleanValue()`
- No pi dependency, no I/O, no imports from other src/ modules
- Used by: `env.ts`, `models.ts`, `auth.ts`, `workos.ts`

### Layer 1: Domain Modules (pure logic with injectable I/O)

| Module          | Responsibility                                                                               | DI Pattern                                                     |
| --------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/env.ts`    | Constants, `resolveApiBase`, `sanitizeApiKey`, `buildEndpointUrl`                            | None (pure trivially)                                          |
| `src/models.ts` | `ModelConfig`, `MODELS`, `fetchRemoteModels`, `resolveModels`                                | `RemoteModelsOptions { fetch?, apiBase?, timeoutMs? }`         |
| `src/auth.ts`   | `AuthKeyOptions`, `defaultAuthPaths`, `resolveApiKey`                                        | `AuthKeyOptions { readFile?, fileExists?, env?, authPaths? }`  |
| `src/workos.ts` | `ClineAuthCredentials`, `isWorkosToken`, `resolveClineAuthCredentials`, `refreshWorkosToken` | `AuthKeyOptions` + `WorkosRefreshOptions { fetch?, apiBase? }` |
| `src/errors.ts` | `ClinePassErrorType`, `CLINEPASS_ERROR_MESSAGES`, `classifyClinePassError`                   | None (pure, no I/O)                                            |

### Layer 2: Orchestration Modules

#### `src/oauth.ts` — Login flow + credential dispatch

- Pure orchestration — delegates all WorkOS protocol to `workos.ts`
- Two auth paths: WorkOS OAuth (auto-detect from Cline CLI) and static API key (manual paste)
- Exports: `login()`, `refreshToken()`, `getApiKey()`
- Imports `refreshWorkosToken`, `resolveClineAuthCredentials`, `credentialsFromWorkos` from `workos.ts`
- No knowledge of HTTP endpoints, body formats, or prefix enforcement

#### `src/error-handler.ts` — Error surface pipeline

- Owns the full pipeline: filter (type assert → stopReason check → provider check) → classify (delegates to `errors.ts`) → deliver (`ctx.ui.notify` or `console.error`)
- Deep module: a single `handleClinePassError(event, ctx)` function, with all complexity behind the seam
- `index.ts` is a one-liner: `pi.on("message_end", handleClinePassError)`

### Layer 3: Extension Entry (`src/index.ts`)

- Thin orchestration layer — wires domain modules + oauth into pi's `ExtensionAPI`
- Async default export: `resolveApiBase` → `resolveApiKey` → `resolveModels` → `pi.registerProvider` → `pi.on("message_end", handleClinePassError)`
- No business logic — delegates everything to layers 1-2

## Data Flow

### Registration Flow (startup)

```text
1. pi loads src/index.ts via await import()
2. resolveApiBase() from env.ts → determines API endpoint
3. resolveApiKey() from auth.ts → finds API key (env → Cline CLI config → pi auth.json)
4. resolveModels(apiKey) from models.ts → tries fetchRemoteModels(), falls back to static MODELS
5. pi.registerProvider("clinepass", {baseUrl, apiKey, api, oauth, models})
6. pi.on("message_end", handleClinePassError) from error-handler.ts
```

### Request Flow (user sends message)

```
1. pi sends chat completion request to https://api.cline.bot/api/v1/chat/completions
2. Uses openai-completions streaming (pi built-in, no custom streamSimple)
3. SSE stream → pi processes tokens, tool calls, usage
4. On error: message_end event fires with stopReason="error" + errorMessage
5. handleClinePassError(event, ctx) from error-handler.ts:
   a. Filter: type-assert message, check stopReason + provider, early return if not clinepass
   b. Classify: classifyClinePassError from errors.ts
   c. Deliver: ctx.ui.notify(friendlyMessage, "error") or console.error fallback
```

### OAuth Refresh Flow

```
1. pi detects token expiry → calls refreshToken() from oauth.ts
2. refreshToken() checks isWorkosToken(credentials.access) — delegates to workos.ts
3. If WorkOS: refreshWorkosToken(credentials) from workos.ts:
   a. POST /api/v1/auth/refresh with {granttype, refreshToken}
   b. Parse response { data: { accessToken, refreshToken } }
   c. Ensure "workos:" prefix on new accessToken
   d. Return OAuthCredentials
4. If static key: credentialsFromApiKey(credentials.refresh) — no-op (keys don't expire)
5. Returns updated OAuthCredentials to pi for persistence
```

## Key Abstractions

| Abstraction            | Location                          | Purpose                             |
| ---------------------- | --------------------------------- | ----------------------------------- |
| `ModelConfig`          | `src/models.ts`                   | Static model definition shape       |
| `AuthKeyOptions`       | `src/auth.ts`                     | DI interface for auth file I/O      |
| `RemoteModelsOptions`  | `src/models.ts`                   | DI interface for remote model fetch |
| `WorkosRefreshOptions` | `src/workos.ts`                   | DI interface for token refresh      |
| `ClineAuthCredentials` | `src/workos.ts`                   | WorkOS OAuth credentials shape      |
| `ClinePassErrorType`   | `src/errors.ts`                   | Error classification union type     |
| `OAuthCredentials`     | `@earendil-works/pi-ai`           | pi's credential storage shape       |
| `ExtensionAPI`         | `@earendil-works/pi-coding-agent` | pi's extension API interface        |
| `ProviderConfig`       | `@earendil-works/pi-coding-agent` | Provider registration config shape  |

## Entry Points

| Entry Point                   | Trigger                                               |
| ----------------------------- | ----------------------------------------------------- |
| `src/index.ts` default export | pi loads extension at startup or via `/reload`        |
| `pi.registerProvider()`       | Called during extension init                          |
| `pi.on("message_end")`        | Called during extension init                          |
| `oauth.login()`               | Called when user runs `pi /login` → selects ClinePass |
| `oauth.refreshToken()`        | Called by pi when stored token expires                |

## Design Decisions

1. **No custom `streamSimple`** — ClinePass uses standard OpenAI Chat Completions format, so pi's built-in `openai-completions` streaming handles everything.
2. **Static model fallback** — Dynamic model discovery tries the Cline API first, but falls back to a hardcoded `MODELS` array (10 models) on any error. The API endpoint currently returns 404.
3. **Deep modules with injectable I/O** — `logic.ts` was split into 6 domain modules (`env`, `models`, `auth`, `workos`, `errors`, `utils`), each with a single responsibility and injectable I/O. The error surface was extracted into `error-handler.ts` (owning filter → classify → deliver). WorkOS protocol was consolidated into `workos.ts`.
4. **Error surface via `message_end`** — The `after_provider_response` event can't be used for error detection because the OpenAI SDK throws before `onResponse` fires for non-2xx status codes. The `message_end` event carries `stopReason: "error"` and `errorMessage` from the stream's catch block. The `error-handler.ts` module owns this pipeline.
5. **WorkOS protocol adapter** — All WorkOS HTTP protocol knowledge (endpoint URL, body format, response parsing, prefix enforcement) lives in `workos.ts`. `oauth.ts` is pure orchestration with no knowledge of the protocol details.
