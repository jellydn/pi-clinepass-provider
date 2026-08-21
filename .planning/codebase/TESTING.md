# Testing Patterns

**Analysis Date:** 2026-07-06

## Test Framework

**Runner:**

- Vitest `^4.1.5`. Config: `vitest.config.ts` (`test.include: ["tests/**/*.test.ts"]`).

**Assertion Library:**

- Vitest built-ins (`expect`, `vi`, `beforeEach`, `afterEach`). No Jest, no Chai.

**Run Commands:**

```bash
npm test              # Run all unit tests (vitest run)
npm run test:watch    # Watch mode (vitest)
npm run test:e2e      # E2E smoke tests (bash tests/e2e/smoke.sh — needs CLINE_API_KEY + pi)
npm run typecheck     # tsc — also validates tests/type/contract.ts
```

**Current state (verified 2026-07-06):**

- 9 test files, 147 tests, all passing in ~254ms.
- typecheck: clean. lint: 0 warnings/0 errors on 19 files.

## Test File Organization

**Location:**

- Separate `tests/` tree, split by tier: `tests/unit/`, `tests/type/`, `tests/e2e/`.
- Unit tests are NOT co-located with source; they mirror src modules 1:1 (`auth.test.ts` ↔ `auth.ts`).

**Naming:**

- Unit: `<module>.test.ts`.
- Type contract: `contract.ts` (intentionally NOT `.test.ts` so Vitest skips it; validated by `tsc`).
- E2E: `smoke.sh`.

**Structure:**

```
tests/
├── unit/
│   ├── auth.test.ts          (18 tests)
│   ├── env.test.ts           (20 tests)
│   ├── error-handler.test.ts (8 tests)
│   ├── errors.test.ts        (13 tests)
│   ├── index.test.ts         (4 tests)
│   ├── models.test.ts        (25 tests)
│   ├── oauth.test.ts         (15 tests)
│   ├── utils.test.ts         (20 tests)
│   └── workos.test.ts        (24 tests)
├── type/contract.ts          (compile-time only)
└── e2e/smoke.sh
```

## Test Structure

**Suite Organization:**

```typescript
// One describe block per exported function/concept, with section dividers.
import { describe, it, expect } from "vitest";
import { resolveApiKey, defaultAuthPaths } from "../../src/auth.js";

describe("resolveApiKey", () => {
  it("returns provided key first", () => { ... });
  it("falls back to env var", () => { ... });
  // ...
});

describe("defaultAuthPaths", () => {
  it("includes Cline CLI providers.json and pi auth.json paths", () => { ... });
});
```

**Patterns:**

- **Setup:** Minimal. `beforeEach`/`afterEach` only where global stubs are needed (`vi.stubGlobal("fetch", ...)` in `models.test.ts` / `index.test.ts`; `vi.mock` + `mockReset` in `oauth.test.ts`).
- **Teardown:** `vi.unstubAllGlobals()` / `mockRestore()` / `mockReset()` in `afterEach`.
- **Assertion:** `expect(...).toBe / toEqual / toHaveLength / toBeUndefined / toThrow(/regex/i) / toHaveBeenCalledTimes`.

## Mocking

**Framework:** Vitest `vi` (`vi.fn`, `vi.mock`, `vi.hoisted`, `vi.stubGlobal`, `vi.spyOn`).

**Patterns:**

```typescript
// 1. Dependency injection (preferred — no global stubbing):
const readFile = () => JSON.stringify({ apiKey: "cline_from_file" });
const fileExists = () => true;
expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_from_file");

// 2. Injectable fetch:
const mockFetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ data: [...] }), { status: 200, headers: { "Content-Type": "application/json" } }),
);
await fetchRemoteModels({ apiKey: "test_key", fetch: mockFetch });
const [url, opts] = mockFetch.mock.calls[0];

// 3. Module mock with partial real-module passthrough (oauth.test.ts):
const { mockResolveClineAuthCredentials, mockRefreshWorkosToken } = vi.hoisted(() => ({
  mockResolveClineAuthCredentials: vi.fn(),
  mockRefreshWorkosToken: vi.fn(),
}));
vi.mock("../../src/workos.js", async () => ({
  ...(await vi.importActual<typeof import("../../src/workos.js")>("../../src/workos.js")),
  resolveClineAuthCredentials: mockResolveClineAuthCredentials,
  refreshWorkosToken: mockRefreshWorkosToken,
}));

// 4. Console spy (for warning/error paths):
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
// ... exercise code ...
expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[clinepass]"));
warnSpy.mockRestore();
```

**What to Mock:**

- `readFile`, `fileExists` (via `AuthKeyOptions`) — never touch the real filesystem.
- `fetch` (via `RemoteModelsOptions` / `WorkosRefreshOptions`, or `vi.stubGlobal` for `index.test.ts`).
- `env` (via `AuthKeyOptions.env` / `resolveApiBase(env)`).
- `callbacks: OAuthLoginCallbacks` (via a `makeCallbacks` helper in `oauth.test.ts`).
- `console.warn` / `console.error` when asserting log output.

**What NOT to Mock:**

- The module under test itself (except `oauth.test.ts` mocks `workos.ts` to isolate dispatch logic, using `vi.importActual` to keep real constants/guards).
- `OAuthCredentials` shape — construct real objects.

## Fixtures and Factories

**Test Data:**

- Inline JSON strings for auth-file shapes: `JSON.stringify({ providers: { "cline-pass": { settings: { apiKey: "..." } } } })`.
- Inline `OAuthCredentials` objects.
- Helper builders: `makeCallbacks(overrides?)` (oauth), `makeUICtx(notifyCalls)` (error-handler), `mockFetchOK(body)` (workos).

**Location:**

- Helpers are defined at the top of the test file that uses them (no shared `tests/helpers/` directory). `unicorn/consistent-function-scoping` is disabled in tests to permit this.

## Coverage

**Requirements:** None enforced. No coverage threshold, no `vitest --coverage` config, no CI coverage gate.

**View Coverage:**

```bash
npx vitest run --coverage   # not configured in package.json; would need @vitest/coverage-* installed
```

## Test Types

**Unit Tests:**

- Scope: Pure logic with injected I/O. Every filesystem read, network fetch, and env var access is mocked via the options-object DI pattern. Fast (~3-48ms per file; full suite ~254ms).
- Approach: Equivalence + edge cases — null/undefined/malformed inputs, ENOENT vs corrupt files, prefix presence/absence, thinking-level matrix completeness, fallback behavior on 404/network error.

**Integration Tests:**

- Not a separate tier. `tests/unit/index.test.ts` is the closest — it imports the real `src/index.ts` and exercises the full registration path with a fake `ExtensionAPI` and stubbed `fetch` (404 → static fallback).

**E2E Tests:**

- `tests/e2e/smoke.sh` — Bash script. Real API calls via `pi --no-extensions -e <provider> --model ... -p <prompt>` and a `curl` auth check. Tests 4 model prompts (DeepSeek V4 Flash, MiMo V2.5, Kimi K2.6), invalid-key handling, invalid-model handling. Requires `CLINE_API_KEY` + `pi` globally installed. Runs in CI only on `workflow_dispatch` with `run_e2e=true`.

**Type Contract Tests:**

- `tests/type/contract.ts` — compile-time only. Asserts `const contractCheck: (api: ExtensionAPI) => Promise<void> = extension;` so a breaking pi contract change fails `tsc`. Skipped by Vitest (no `.test.ts` suffix).

## Common Patterns

**Async Testing:**

```typescript
it("returns remote models when fetch succeeds", async () => {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify({ data: [...] }), { status: 200 }));
  const result = await resolveModels("test_key");
  expect(result).toHaveLength(2);
});
```

**Error Testing:**

```typescript
await expect(refreshWorkosToken(cred, { fetch: mockFetch })).rejects.toThrow(
  /token refresh failed/i,
);
await expect(login(callbacks)).rejects.toThrow("No ClinePass API key provided");
```

**Fallback / undefined-signal Testing:**

```typescript
const result = await fetchRemoteModels({ apiKey: undefined });
expect(result).toBeUndefined(); // undefined = "fall back to static"
```

**Thinking-level matrix invariants (models.test.ts):**

- Group tests enumerate specific model IDs and assert all 6 levels per model (e.g. DeepSeek supports only `high`/`xhigh→high`; Kimi marks `off` null; GLM-5.2 supports `xhigh: "max"`). When adding a model, update the relevant group assertion.

---

_Testing analysis: 2026-07-06_
