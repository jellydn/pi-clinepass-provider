# STRUCTURE.md — Directory Structure

## Layout

```
pi-clinepass-provider/
├── .github/
│   └── workflows/
│       └── ci.yml              # CI: 3-variant matrix test (Node 22 + 24) + E2E smoke
├── .planning/
│   ├── architecture-review.html # Architecture deepening candidates report
│   └── codebase/               # Generated codebase maps (this directory)
├── src/
│   ├── index.ts                # Extension entry point — thin orchestration
│   ├── utils.ts                # Shared type guards (leaf dependency)
│   ├── env.ts                  # Constants + env helpers
│   ├── models.ts               # Model config + dynamic discovery
│   ├── auth.ts                 # API key resolution from env/files
│   ├── workos.ts               # WorkOS protocol adapter (token + HTTP refresh)
│   ├── oauth.ts                # Login flow + credential dispatch (thin)
│   ├── errors.ts               # Error classification (pure, no I/O)
│   └── error-handler.ts        # Error surface pipeline (filter→classify→deliver)
├── tests/
│   ├── unit/
│   │   ├── env.test.ts         # 14 tests for env.ts
│   │   ├── models.test.ts      # 15 tests for models.ts
│   │   ├── auth.test.ts        # 15 tests for auth.ts
│   │   ├── workos.test.ts      # 20 tests for workos.ts (tokens + refresh protocol)
│   │   ├── errors.test.ts      # 14 tests for errors.ts
│   │   ├── error-handler.test.ts # 8 tests (calls handler directly, no bootstrap)
│   │   ├── oauth.test.ts       # 4 tests — dispatch only, protocol tests moved
│   │   └── index.test.ts       # 4 tests — registration + listener only
│   └── e2e/
│       └── smoke.sh            # E2E smoke tests (real API, manual trigger)
├── doc/adr/                    # Architecture Decision Records (5 ADRs)
├── package.json                # Project metadata, scripts, deps, pi config
├── package-lock.json           # Lockfile (npm ci compatible)
├── tsconfig.json               # TypeScript config (strict, ESM, noEmit)
├── vitest.config.ts            # Test runner config
├── .oxlintrc.json              # Linter config (oxlint)
├── README.md                   # User-facing documentation
├── AGENTS.md                   # Agent/developer guide
└── LICENSE                     # MIT license
```

## Key Locations

| What                          | Where                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| Extension entry point         | `src/index.ts` → `export default async function (pi: ExtensionAPI)`                          |
| Shared type guards            | `src/utils.ts` → `isRecord()`, `stringValue()`, etc.                                         |
| Constants + env helpers       | `src/env.ts` → `DEFAULT_API_BASE`, `resolveApiBase()`, `sanitizeApiKey()`                    |
| Model definitions             | `src/models.ts` → `MODELS` constant (10 models), `ModelConfig`                               |
| Dynamic model discovery       | `src/models.ts` → `fetchRemoteModels()`, `resolveModels()`                                   |
| API key resolution            | `src/auth.ts` → `resolveApiKey()`, `defaultAuthPaths()`                                      |
| WorkOS protocol adapter       | `src/workos.ts` → `isWorkosToken()`, `resolveClineAuthCredentials()`, `refreshWorkosToken()` |
| OAuth login flow              | `src/oauth.ts` → `login()`, `refreshToken()`, `getApiKey()`                                  |
| Error classification          | `src/errors.ts` → `classifyClinePassError()`, `CLINEPASS_ERROR_MESSAGES`                     |
| Error surface pipeline        | `src/error-handler.ts` → `handleClinePassError(event, ctx)`                                  |
| CI workflow                   | `.github/workflows/ci.yml`                                                                   |
| E2E tests                     | `tests/e2e/smoke.sh`                                                                         |
| Architecture Decision Records | `doc/adr/`                                                                                   |

## Naming Conventions

| Category         | Convention               | Example                                                        |
| ---------------- | ------------------------ | -------------------------------------------------------------- |
| Source files     | lowercase, no separators | `index.ts`, `models.ts`, `error-handler.ts`                    |
| Test files       | `<module>.test.ts`       | `env.test.ts`, `workos.test.ts`, `error-handler.test.ts`       |
| Constants        | UPPER_SNAKE_CASE         | `DEFAULT_API_BASE`, `MODELS_ENDPOINT`, `WORKOS_TOKEN_PREFIX`   |
| Interfaces       | PascalCase               | `ModelConfig`, `AuthKeyOptions`, `ClineAuthCredentials`        |
| Types            | PascalCase               | `ClinePassErrorType`, `WorkosRefreshOptions`                   |
| Functions        | camelCase                | `resolveApiKey`, `fetchRemoteModels`, `classifyClinePassError` |
| Section comments | `// ─── Title ───...`    | `// ─── Token Refresh ───...`                                  |

## File Sizes

| File                        | Lines | Role                                               |
| --------------------------- | ----- | -------------------------------------------------- |
| `src/workos.ts`             | ~160  | WorkOS protocol adapter (largest domain module)    |
| `src/models.ts`             | ~150  | Model config + dynamic discovery                   |
| `src/auth.ts`               | ~120  | API key resolution                                 |
| `src/index.ts`              | ~80   | Extension entry (thinnest — pure orchestration)    |
| `src/env.ts`                | ~80   | Constants + env helpers                            |
| `src/error-handler.ts`      | ~60   | Error surface pipeline                             |
| `src/errors.ts`             | ~50   | Error classification (pure)                        |
| `src/utils.ts`              | ~30   | Shared type guards                                 |
| `src/oauth.ts`              | ~100  | Login/orchestration (thinned — no protocol)        |
| `tests/unit/workos.test.ts` | ~200  | Most tests — tokens + refresh protocol             |
| `tests/unit/auth.test.ts`   | ~180  | API key tests                                      |
| `tests/unit/models.test.ts` | ~180  | Model tests                                        |
| `tests/unit/index.test.ts`  | ~80   | Registration tests (thinned — handler tests moved) |
| `tests/e2e/smoke.sh`        | ~130  | E2E smoke script                                   |
