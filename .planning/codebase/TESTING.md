# TESTING.md — Testing

## Framework

| Component | Tool |
|-----------|------|
| **Runner** | Vitest 4.x |
| **Assertions** | Vitest built-in (`expect`) |
| **Mocking** | `vi.fn()`, `vi.mock()`, `vi.spyOn()`, `vi.stubGlobal()` |
| **Config** | `vitest.config.ts` — includes `tests/**/*.test.ts` |

## Test Structure

```
tests/
├── unit/                  # Unit tests (8 files, 132 tests)
│   ├── auth.test.ts       # 15 tests
│   ├── workos.test.ts     # 17 tests
│   ├── oauth.test.ts      # 13 tests
│   ├── models.test.ts     # 14 tests
│   ├── errors.test.ts     # 13 tests
│   ├── error-handler.test.ts  # 9 tests
│   ├── env.test.ts        # 17 tests
│   └── utils.test.ts      # 24 tests
└── e2e/
    └── smoke.sh           # E2E smoke test (requires real API key + pi)
```

## Testing Philosophy

### Pure Unit Tests Only
- No filesystem access — all I/O is injected via options objects
- No network calls — `fetch` is mocked via `vi.stubGlobal("fetch", vi.fn())` or injected
- No database, no environment, no side effects
- Tests run in <1 second total

### Dependency Injection Pattern

Every testable function accepts an options object:

```typescript
// auth.ts — production
resolveApiKey(undefined)  // uses real fs, env, homeDir

// auth.test.ts — test
resolveApiKey(undefined, {
  readFile: () => JSON.stringify({ apiKey: "test_key" }),
  fileExists: () => true,
})  // no fs access
```

### Mocking Strategy

| Mock Target | Technique |
|-------------|-----------|
| File I/O | Inject `readFile` / `fileExists` lambdas via options |
| Environment | Inject `env: Record<string, string>` via options |
| Home directory | Inject `homeDir: () => string` via options |
| `fetch` | `vi.stubGlobal("fetch", vi.fn())` in `beforeEach`, `vi.unstubAllGlobals()` in `afterEach` |
| `console.warn` / `console.error` | `vi.spyOn(console, "warn").mockImplementation(() => {})` |
| WorkOS module | `vi.mock("../../src/workos.js", ...)` with `vi.hoisted()` mocks + `vi.importActual()` for partial mocking |

## Test Patterns

### Describe/It Structure

```typescript
describe("functionName", () => {
  it("describes the specific behavior being tested", () => {
    // Arrange
    const readFile = () => JSON.stringify({ ... });
    // Act
    const result = resolveApiKey(undefined, { readFile, fileExists });
    // Assert
    expect(result).toBe("expected_value");
  });
});
```

### WorkOS Module Mocking (`oauth.test.ts`)

Uses `vi.mock()` with `vi.hoisted()` + `vi.importActual()` to mock only `resolveClineAuthCredentials` and `refreshWorkosToken` while keeping other exports real:

```typescript
const { mockResolveClineAuthCredentials, mockRefreshWorkosToken } = vi.hoisted(() => ({
  mockResolveClineAuthCredentials: vi.fn(),
  mockRefreshWorkosToken: vi.fn(),
}));

vi.mock("../../src/workos.js", async () => ({
  ...(await vi.importActual<typeof import("../../src/workos.js")>("../../src/workos.js")),
  resolveClineAuthCredentials: mockResolveClineAuthCredentials,
  refreshWorkosToken: mockRefreshWorkosToken,
}));
```

### Test Coverage by Module

| Module | Tests | Key Scenarios Covered |
|--------|-------|----------------------|
| `auth.ts` | 15 | Provided key, env var, Cline CLI nested, pi auth.json (apiKey, string clinepass, OAuth object), WorkOS token skip, priority order, missing files, malformed JSON, fallback paths |
| `workos.ts` | 17 | Token prefix detection, credential extraction (cline-pass, cline, priority), missing fields, refresh endpoint + body, prefix handling, error responses, missing tokens, edge cases |
| `oauth.ts` | 13 | WorkOS auto-login (valid, expired, near-expiry), manual paste (success, empty, whitespace, short key warning, terminal paste wrappers), refresh dispatch (static vs WorkOS), getApiKey |
| `models.ts` | 14 | Static model IDs, model field validation, remote fetch (no key, non-OK, network error, {data: [...]} format, bare array, non-cline-pass filtering, fallback values, empty list), resolveModels fallback |
| `errors.ts` | 13 | 403/forbidden/subscription/not-subscribed → not_subscribed, 401/unauthorized/invalid-api-key → auth_expired, 429/rate-limit/too-many → rate_limited, unknown fallback, case insensitivity, empty string |
| `error-handler.ts` | 9 | 403/401/429 surface, ctx.model.provider fallback, unknown errors, non-clinepass provider ignore, non-error stopReasons, console.error fallback when no UI |
| `env.ts` | 17 | Constants validation, env override, trailing slash removal, whitespace trim, empty/whitespace fallback, sanitization (whitespace, terminal paste wrappers, control chars, DEL, combined paste), endpoint URL builder |
| `utils.ts` | 24 | isRecord (plain objects, null, arrays, primitives, functions, Date), stringValue (strings, non-strings), numberValue (finite numbers, Infinity, NaN, parseable strings, non-parseable strings), booleanValue (true, false, truthy/falsy non-booleans) |

## E2E Tests

- Script: `tests/e2e/smoke.sh`
- Requires: `pi` globally installed, `CLINE_API_KEY` set
- Runs: `pi --no-extensions -e <provider_path>`
- CI: only on `workflow_dispatch` with `run_e2e=true`

## Running Tests

```bash
npm test              # All unit tests (vitest run)
npm run test:watch    # Watch mode
npm run test:e2e      # E2E smoke test
```

## Test Quality Principles

- **One assertion per scenario** — each `it()` tests exactly one behavior
- **Arrange-Act-Assert** — clear separation in every test
- **No shared mutable state** — each test is self-contained
- **Descriptive test names** — describes behavior, not implementation
- **Mock at boundaries** — mock I/O, not internal functions
