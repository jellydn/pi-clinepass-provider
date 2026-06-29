# ARCHITECTURE.md — System Architecture

## Pattern: Layered + Dependency Injection

The codebase follows a **layered architecture with dependency injection (DI)** for testability. Every I/O operation (file reads, environment variables, HTTP fetches, home directory) is parameterized through options objects rather than called directly. This allows unit tests to inject mocks without touching the filesystem or network.

## Module Map

```
src/
├── index.ts          # Extension entry point — wires everything together
├── utils.ts          # Shared type guards (isRecord, stringValue, numberValue, booleanValue)
├── env.ts            # Constants, API base resolution, key sanitization, URL builder
├── errors.ts         # Error classification (403→subscription, 401→auth, 429→rate limit)
├── error-handler.ts  # Error surface — filter → classify → deliver pipeline
├── models.ts         # Static model catalog + dynamic model discovery with fallback
├── auth.ts           # API key resolution (env var → Cline CLI → pi auth.json)
├── workos.ts         # WorkOS OAuth — credential extraction, token refresh
└── oauth.ts          # /login flow — two paths (WorkOS auto-detect, manual paste)
```

## Layer Dependencies (top-down)

```
index.ts
  ├── env.ts          (resolveApiBase, PROVIDER_NAME, ENV_API_KEY)
  ├── auth.ts         (resolveApiKey)
  │     ├── utils.ts  (isRecord, stringValue)
  │     └── env.ts    (ENV_API_KEY)
  ├── models.ts       (resolveModels)
  │     ├── utils.ts  (isRecord, stringValue, numberValue, booleanValue)
  │     └── env.ts    (resolveApiBase)
  ├── error-handler.ts (handleClinePassError)
  │     ├── errors.ts (classifyClinePassError)
  │     └── env.ts    (PROVIDER_NAME)
  └── oauth.ts        (login, refreshToken, getApiKey)
        ├── env.ts    (sanitizeApiKey)
        └── workos.ts (resolveClineAuthCredentials, refreshWorkosToken, ...)
              ├── utils.ts  (isRecord, stringValue)
              ├── env.ts    (resolveApiBase)
              └── auth.ts   (defaultAuthPaths, walkClineProviderSettings)
```

**Notable:** `auth.ts` exports `walkClineProviderSettings` which `workos.ts` imports — the shared traversal helper eliminates duplicated provider iteration between the two modules. No circular dependencies exist.

## Three-Stage Error Pipeline

1. **Filter** (`error-handler.ts`) — checks `stopReason === "error"`, `errorMessage` present, `provider === "clinepass"`
2. **Classify** (`errors.ts`) — pattern-matches the error message against known ClinePass failures
3. **Deliver** (`error-handler.ts`) — `ctx.ui.notify()` when UI is available, `console.error()` fallback

## Two Authentication Paths

### Path 1: WorkOS OAuth (automatic)
- Credentials stored by Cline CLI at `~/.cline/data/settings/providers.json`
- Extracted by `resolveClineAuthCredentials()` in `workos.ts`
- Short-lived (~1 hour), auto-refreshed via `/api/v1/auth/refresh`
- Detected by `workos:` token prefix

### Path 2: Static API Key (manual)
- Created at `app.cline.bot → Settings → API Keys`
- Long-lived (treated as 10-year expiry)
- Pasted during `/login` flow
- Stored in pi's `auth.json` or set via `CLINE_API_KEY` env var

## Key Resolution Priority

`resolveApiKey()` checks in order:
1. Explicitly provided key (function parameter)
2. `CLINE_API_KEY` environment variable
3. `~/.cline/data/settings/providers.json` — Cline CLI nested format (static `apiKey` only; skips WorkOS `auth.accessToken`)
4. `~/.pi/agent/auth.json` — pi OAuth format (direct `apiKey`, string `clinepass`, or object `clinepass.access`; skips `workos:`-prefixed values)

## Model Resolution

`resolveModels()` tries the remote API first, falls back to the static `MODELS` array:
1. If an API key is available, calls `fetchRemoteModels()` (5-second timeout)
2. On any error (network, 404, parse failure, empty list), returns static `MODELS`
3. Remote models are filtered to only `cline-pass/`-prefixed IDs
4. Missing fields in remote entries fall back to static model values

## OAuth login Flow

`login()` has two branches:
1. **WorkOS auto-detect**: if `resolveClineAuthCredentials()` returns credentials, use them (refresh if expired). No browser navigation needed.
2. **Manual paste**: opens Cline dashboard, prompts user to paste API key. Sanitizes input (terminal paste wrappers, control characters, whitespace).

## Dependency Injection Pattern

Every module that does I/O accepts an options object:

```typescript
// auth.ts
export interface AuthKeyOptions {
  env?: Record<string, string | undefined>;
  authPaths?: readonly string[];
  homeDir?: () => string;
  readFile?: (path: string) => string;
  fileExists?: (path: string) => boolean;
}

// models.ts
export interface RemoteModelsOptions {
  apiBase?: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

// workos.ts
export interface WorkosRefreshOptions {
  fetch?: typeof globalThis.fetch;
  apiBase?: string;
}
```

Defaults use the real implementations (`process.env`, `readFileSync`, `existsSync`, `homedir()`, `globalThis.fetch`).

## File Sizes

| File | Lines | Responsibility |
|------|-------|---------------|
| `src/models.ts` | 223 | Model catalog + dynamic discovery |
| `src/oauth.ts` | 115 | Login + refresh dispatch |
| `src/auth.ts` | 150 | API key resolution |
| `src/workos.ts` | 189 | WorkOS token extraction + refresh |
| `src/index.ts` | 67 | Extension entry point |
| `src/env.ts` | 63 | Constants + sanitization + URL builder |
| `src/errors.ts` | 68 | Error classification |
| `src/error-handler.ts` | 53 | Error pipeline |
| `src/utils.ts` | 27 | Type guards |

All files are well under the 1,000-line threshold. The largest file (`models.ts`) is half static data (model definitions).
