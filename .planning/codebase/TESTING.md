# TESTING.md — Testing

## Framework

| Aspect      | Value                                                                      |
| ----------- | -------------------------------------------------------------------------- |
| Test runner | Vitest 4.x                                                                 |
| Config      | `vitest.config.ts` → includes `tests/**/*.test.ts`                         |
| Run command | `npm test` (or `npm run test:watch` for watch mode)                        |
| Test count  | 96 unit tests across 8 files                                               |
| E2E         | `tests/e2e/smoke.sh` (manual trigger, requires `CLINE_API_KEY` + `pi` CLI) |

## Test Structure

```
tests/
├── unit/
│   ├── env.test.ts           # 14 tests — constants, resolveApiBase, sanitizeApiKey, buildEndpointUrl
│   ├── models.test.ts        # 15 tests — modelIds, MODELS, fetchRemoteModels, resolveModels
│   ├── auth.test.ts          # 15 tests — resolveApiKey, defaultAuthPaths
│   ├── workos.test.ts        # 20 tests — isWorkosToken, constants, resolveClineAuthCredentials, refreshWorkosToken
│   ├── errors.test.ts        # 14 tests — classifyClinePassError (all matchers)
│   ├── error-handler.test.ts # 8 tests — handleClinePassError (called directly, no bootstrap)
│   ├── oauth.test.ts         # 4 tests — refreshToken dispatch, getApiKey (protocol tests moved to workos)
│   └── index.test.ts         # 4 tests — provider registration, message_end listener registration
└── e2e/
    └── smoke.sh              # API auth check, model smoke tests, error handling
```

## Mocking Strategy

### Dependency Injection (primary pattern)

All I/O is injected via options objects — no need to mock modules:

```typescript
// Test passes mock readFile and fileExists — no FS access
const readFile = () => JSON.stringify({ apiKey: "test_key" });
const fileExists = () => true;
expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("test_key");
```

### Injected fetch (for models.ts and workos.ts)

Functions accept injectable `fetch` via options — no global stubbing needed:

```typescript
// models.test.ts — inject fetch directly
const mockFetch = mockFetchOK({ data: [{ id: "cline-pass/glm-5.2", name: "GLM-5.2" }] });
const result = await fetchRemoteModels({ apiKey: "test_key", fetch: mockFetch });

// workos.test.ts — inject fetch directly
const mockFetch = mockFetchOK({ data: { accessToken: "eyJnew_jwt", refreshToken: "new_rt" } });
const result = await refreshWorkosToken(cred, { fetch: mockFetch });
```

### Global fetch stubbing (legacy, for index.test.ts and oauth.test.ts)

Only used where the function doesn't accept injectable fetch (extension bootstrap, dispatch layer):

```typescript
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 })));
});
afterEach(() => {
  vi.unstubAllGlobals();
});
```

### Console spy

For error/warning surface tests:

```typescript
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
// ... trigger error ...
expect(errorSpy).toHaveBeenCalledTimes(1);
errorSpy.mockRestore();
```

### Fake ExtensionAPI

Tests use minimal fake objects with `as never` casts:

```typescript
const fakePi = {
  registerProvider(name: string, config: Record<string, unknown>) {
    captured = { name, config };
  },
  on(_event: string, _handler: unknown) {},
};
await mod.default(fakePi as never);
```

## Test Coverage by Module

### `src/env.ts` (14 tests)

| Function           | Tests | Coverage                                                            |
| ------------------ | ----- | ------------------------------------------------------------------- |
| Constants          | 4     | PROVIDER_NAME, ENV_API_KEY, DEFAULT_API_BASE, DEFAULT_ENDPOINT      |
| `resolveApiBase`   | 2     | Default, env override                                               |
| `sanitizeApiKey`   | 6     | Trim, paste wrappers, control chars, DEL, combined, whitespace-only |
| `buildEndpointUrl` | 2     | Default base, custom base                                           |

### `src/models.ts` (15 tests)

| Function              | Tests | Coverage                                                                                                     |
| --------------------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| `modelIds` / `MODELS` | 4     | IDs, prefix check, field validation, at least 1 model                                                        |
| `fetchRemoteModels`   | 8     | No key, 404, network error, OpenAI format, bare array, non-cline-pass filtering, static fallback, empty list |
| `resolveModels`       | 3     | No key fallback, fetch fail fallback, remote success                                                         |

### `src/auth.ts` (15 tests)

| Function           | Tests | Coverage                                                                                                                   |
| ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| `resolveApiKey`    | 14    | Priority order, env vars, auth files, Cline CLI nested format, WorkOS exclusion, malformed JSON, missing files, path order |
| `defaultAuthPaths` | 1     | Includes both Cline CLI and pi auth paths                                                                                  |

### `src/workos.ts` (20 tests)

| Function                      | Tests | Coverage                                                                                                      |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| `isWorkosToken`               | 4     | workos: prefix, static key, empty string, bare JWT                                                            |
| Constants                     | 3     | WORKOS_TOKEN_PREFIX, CLINE_REFRESH_ENDPOINT, WORKOS_TOKEN_LIFETIME_MS                                         |
| `resolveClineAuthCredentials` | 8     | cline-pass/cline providers, preference order, missing fields, malformed JSON, default expiresAt, missing file |
| `refreshWorkosToken`          | 5     | Endpoint URL + body format, bare JWT prefix, existing prefix preservation, non-OK error, missing tokens error |

### `src/errors.ts` (14 tests)

| Function                 | Tests | Coverage                                                                                                                                                                 |
| ------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `classifyClinePassError` | 14    | 403, forbidden, subscription required, not subscribed, 401, unauthorized, invalid api key, 429, rate limit, too many requests, unknown, case-insensitivity, empty string |

### `src/error-handler.ts` (8 tests)

| Function               | Tests | Coverage                                                                                                               |
| ---------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| `handleClinePassError` | 8     | 403, 401, 429, unknown, provider fallback (ctx.model), other-provider ignore, non-error ignore, console.error fallback |

Tests call `handleClinePassError(event, ctx)` directly — no extension bootstrap, no fetch mocking, no `makeFakePi` helper needed.

### `src/oauth.ts` (4 tests)

| Function       | Tests | Coverage                                           |
| -------------- | ----- | -------------------------------------------------- |
| `refreshToken` | 2     | Static key no-op (no fetch), WorkOS triggers fetch |
| `getApiKey`    | 2     | WorkOS token, static key                           |

Detailed protocol tests (endpoint URL, body format, prefix handling, error cases) live in `workos.test.ts` testing `refreshWorkosToken` directly.

### `src/index.ts` (4 tests)

| Area                  | Tests | Coverage                                                            |
| --------------------- | ----- | ------------------------------------------------------------------- |
| Provider registration | 3     | baseUrl, apiKey, api type, authHeader; model fallback; oauth wiring |
| Listener registration | 1     | Registers `message_end` listener                                    |

Error handler behavior is tested in `error-handler.test.ts` — `index.test.ts` only verifies the listener is registered.

## E2E Smoke Tests

`tests/e2e/smoke.sh` runs real API calls against Cline's endpoint:

| Test                          | What it checks                              |
| ----------------------------- | ------------------------------------------- |
| API Auth Check                | HTTP status from `/api/v1/chat/completions` |
| DeepSeek V4 Flash (math)      | Simple arithmetic response                  |
| DeepSeek V4 Flash (knowledge) | Capital of Japan                            |
| MiMo V2.5 (math)              | Simple arithmetic                           |
| Kimi K2.6 (math)              | Simple arithmetic                           |
| Invalid API key               | Error message for bad credentials           |
| Invalid model ID              | Error message for nonexistent model         |

**Requirements:** `CLINE_API_KEY` env var, `pi` CLI installed globally.
**CI trigger:** `workflow_dispatch` with `run_e2e=true` (not on every push).

## CI Test Matrix

The CI workflow runs tests against three variants:

| Matrix variant            | Pi version                                   | Node | Steps                                   |
| ------------------------- | -------------------------------------------- | ---- | --------------------------------------- |
| `latest / Node 22`        | From lockfile (`npm ci`)                     | 22   | lint + typecheck + format:check + tests |
| `min-pi-0.80.2 / Node 22` | Pinned to 0.80.2 via `npm install --no-save` | 22   | typecheck + tests only                  |
| `latest / Node 24`        | From lockfile (`npm ci`)                     | 24   | typecheck + tests only                  |

E2E smoke tests also run against Node 22 and Node 24 via matrix strategy (manual trigger). `fail-fast: false` ensures all variants complete.
