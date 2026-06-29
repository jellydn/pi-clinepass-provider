# 6. Module split and WorkOS protocol adapter extraction

Date: 2026-06-30

## Status

Accepted

## Context

The original `src/logic.ts` was a 630-line God Module containing 7 unrelated concerns — environment configuration (constants, `resolveApiBase`, `sanitizeApiKey`), model definitions (`MODELS`, `ModelConfig`), dynamic model discovery (`fetchRemoteModels`, `resolveModels`), API key resolution (`resolveApiKey`, `defaultAuthPaths`), WorkOS credential extraction (`isWorkosToken`, `resolveClineAuthCredentials`, constants), error classification (`classifyClinePassError`, `CLINEPASS_ERROR_MESSAGES`), and URL building (`buildEndpointUrl`). This caused poor locality (understanding one concept required scanning 630 lines) and test bloat (`logic.test.ts` had 73 tests for unrelated functions).

Additionally, two shallow patterns had emerged:

1. **Inline error handling in `src/index.ts`** — the `message_end` event handler (~15 lines doing type assertion → stopReason check → provider check → classify → deliver) had an interface nearly as complex as its implementation. The classification lived in `logic.ts` (now `errors.ts`), but the filtering and delivery were inline in the entry point with no owning module.

2. **WorkOS protocol leakage into `src/oauth.ts`** — the `refreshWorkosToken` function in `oauth.ts` knew the WorkOS HTTP endpoint, request body format (`{ granttype: "refresh_token", refreshToken }`), response parsing (`data.accessToken`), and prefix enforcement. `oauth.ts` is nominally the orchestration layer, but it contained protocol-level WorkOS details better owned by `src/workos.ts`.

## Decision

Three related refactors were performed:

### 1. God Module split

`src/logic.ts` was deleted and its contents distributed into 6 focused domain modules, each with a single responsibility:

- **`src/utils.ts`** — shared type guards (`isRecord`, `stringValue`, `numberValue`, `booleanValue`). Leaf dependency (no imports from other src/ modules).
- **`src/env.ts`** — constants (`DEFAULT_API_BASE`, `DEFAULT_ENDPOINT`, `ENV_API_KEY`, `PROVIDER_NAME`) and helpers (`resolveApiBase`, `sanitizeApiKey`, `buildEndpointUrl`). Depends on `utils.ts`.
- **`src/models.ts`** — model types (`ModelConfig`), static list (`MODELS`), and dynamic discovery (`fetchRemoteModels`, `resolveModels`) with injectable `RemoteModelsOptions { fetch?, apiBase?, timeoutMs? }`. Depends on `env.ts`, `utils.ts`.
- **`src/auth.ts`** — key resolution (`resolveApiKey`, `defaultAuthPaths`) with injectable `AuthKeyOptions { readFile?, fileExists?, env?, authPaths? }`. Depends on `env.ts`, `utils.ts`.
- **`src/workos.ts`** — WorkOS protocol (initially: token prefix detection, credential extraction from providers.json). Depends on `env.ts`, `utils.ts`, `auth.ts`.
- **`src/errors.ts`** — pure error classification (`classifyClinePassError`, `ClinePassErrorType`, `CLINEPASS_ERROR_MESSAGES`). No dependencies on src/ modules.

All `src/logic.ts` exports were preserved. `src/index.ts` and `src/oauth.ts` were updated with direct imports from the new modules (no barrel re-export). `tests/unit/logic.test.ts` was split into corresponding focused test files.

### 2. Error handler extraction

A new `src/error-handler.ts` module was created, owning the full error surface pipeline:

- **Filter** — type-asserts `event.message` for `stopReason`, `errorMessage`, `provider`; early-returns if `stopReason !== "error"` or no `errorMessage`; checks `provider = msg.provider ?? ctx.model?.provider` matches `PROVIDER_NAME`.
- **Classify** — delegates to `classifyClinePassError` from `errors.ts`.
- **Deliver** — calls `ctx.ui.notify(friendlyMessage, "error")` when `ctx.hasUI`, else `console.error`.

The interface is a single function: `handleClinePassError(event: { message: unknown }, ctx: ...): void`. `src/index.ts` now delegates via a single call site: `pi.on("message_end", handleClinePassError)`.

The handler tests were moved from `index.test.ts` to `error-handler.test.ts`, calling `handleClinePassError` directly with raw `(event, ctx)` arguments — no fetch mocking, no extension bootstrap, no `makeFakePi` helper needed.

### 3. WorkOS protocol adapter consolidation

`refreshWorkosToken` and `credentialsFromWorkos` were moved from `src/oauth.ts` to `src/workos.ts`, making `workos.ts` the sole owner of all WorkOS protocol knowledge:

- Token detection (`isWorkosToken`)
- Credential extraction from Cline CLI config (`resolveClineAuthCredentials`)
- HTTP refresh protocol (`refreshWorkosToken` — endpoint URL, body format, response parsing, prefix enforcement, error messages)
- Credential construction (`credentialsFromWorkos`)
- Constants (`WORKOS_TOKEN_PREFIX`, `CLINE_REFRESH_ENDPOINT`, `WORKOS_TOKEN_LIFETIME_MS`, `WORKOS_REFRESH_MARGIN_MS`)

`refreshWorkosToken` was updated to accept injectable `WorkosRefreshOptions { fetch?, apiBase? }`, consistent with the DI pattern used by `fetchRemoteModels` and `resolveClineAuthCredentials`. Tests now pass a mock `fetch` directly instead of stubbing `globalThis` — no `beforeEach`/`afterEach` needed.

`src/oauth.ts` became pure orchestration — it imports `refreshWorkosToken`, `resolveClineAuthCredentials`, and `credentialsFromWorkos` from `workos.ts` and has no knowledge of HTTP endpoints, body formats, or prefix enforcement.

## Consequences

### 📋 Positive

- **Locality** — each module has a single, obvious responsibility. Understanding model discovery requires reading only `models.ts` (~150 lines). Understanding the error surface requires reading only `error-handler.ts` + `errors.ts` (~100 lines combined).
- **Deep modules** — `handleClinePassError(event, ctx)` has a trivial interface masking a non-trivial pipeline. `refreshWorkosToken(credentials, options?)` similarly hides HTTP protocol details. The deletion test passes — removing either would concentrate complexity back into the entry point.
- **Test alignment** — test files match source modules 1:1. `workos.test.ts` tests all WorkOS protocol paths. `error-handler.test.ts` tests the handler directly without bootstrapping the extension. No more 73-test monolith.
- **Consistent DI patterns** — all I/O-bound functions now use the same options-object pattern (`AuthKeyOptions`, `RemoteModelsOptions`, `WorkosRefreshOptions`). Tests inject mocks; production defaults to real implementations.
- **No circular dependencies** — the dependency graph flows cleanly: `utils → env → {models, auth, workos → auth}`, with `errors` and `error-handler` as downstream consumers.

### 📋 Negative

- **More files** — 6 source files replaced 1, plus 5 test files replaced 1. Developers need to navigate more files to understand the full codebase. Mitigated by clear naming and the dependency graph documented in `ARCHITECTURE.md`.
- **Named-function type compatibility** — `pi.on("message_end", handleClinePassError)` relies on TypeScript structural typing for compatibility with pi's expected handler signature. If pi's `ExtensionHandler` type changes significantly, the function signature may need adjustment. The previous inline arrow function was immune to this because it was contextually typed.
- `**credentialsFromWorkos` visibility\*\* — this small helper (3 field assignments) is exported from `workos.ts` because `oauth.ts`'s `login()` function needs it. It's marked `@internal` in JSDoc but is technically part of the module's public API. A future refactor could inline it into `refreshWorkosToken` and expose both paths (refresh + direct) through the same function.
