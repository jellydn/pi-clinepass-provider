# STRUCTURE.md — Directory Structure

## Project Root

```
pi-clinepass-provider/
├── src/                    # Source code (9 TypeScript modules)
├── tests/                  # Test files
│   ├── unit/               # Unit tests (8 files, 132 tests)
│   └── e2e/                # E2E smoke test script
├── .planning/              # Planning documents (codebase map)
│   └── codebase/           # Generated codebase documentation
├── doc/                    # Additional documentation
├── .github/                # CI workflows
├── node_modules/           # Dependencies (gitignored)
├── CHANGELOG.md            # Release history
├── README.md               # Project documentation
├── LICENSE                 # MIT license
├── package.json            # Package metadata + scripts
├── package-lock.json       # Lockfile
├── tsconfig.json           # TypeScript configuration
├── vitest.config.ts        # Vitest configuration
├── .oxlintrc.json          # Linter configuration
├── .oxfmtrc.json           # Formatter configuration
├── prek.toml               # Pre-commit hooks configuration
├── renovate.json           # Dependency update automation
├── AGENTS.md               # Agent guide for AI-assisted development
├── .gitignore              # Git ignore rules
├── .npmignore              # npm publish exclusions
└── models.png              # Model screenshot/logo
```

## Source Modules (`src/`)

```
src/
├── index.ts               # Extension entry point (67 lines)
├── utils.ts               # Type guards (27 lines)
├── env.ts                 # Constants, URL builder, sanitization (63 lines)
├── errors.ts              # Error classification (68 lines)
├── error-handler.ts       # Error pipeline handler (53 lines)
├── models.ts              # Model definitions + discovery (223 lines)
├── auth.ts                # API key resolution (150 lines)
├── workos.ts              # WorkOS OAuth protocol (189 lines)
└── oauth.ts               # Login / refresh flows (115 lines)
```

### Dependency Graph

```
utils.ts          ←  zero dependencies (leaf module)
env.ts            ←  zero dependencies
errors.ts         ←  zero dependencies
error-handler.ts  ←  errors.ts, env.ts
models.ts         ←  utils.ts, env.ts
auth.ts           ←  utils.ts, env.ts
workos.ts         ←  utils.ts, env.ts, auth.ts
oauth.ts          ←  env.ts, workos.ts
index.ts          ←  env.ts, auth.ts, models.ts, error-handler.ts, oauth.ts
```

## Test Structure (`tests/`)

```
tests/
├── unit/
│   ├── auth.test.ts           # API key resolution (15 tests)
│   ├── workos.test.ts         # WorkOS token extraction + refresh (17 tests)
│   ├── oauth.test.ts          # Login / refresh dispatch (13 tests)
│   ├── models.test.ts         # Model discovery + static fallback (14 tests)
│   ├── errors.test.ts         # Error classification (13 tests)
│   ├── error-handler.test.ts  # Error pipeline (9 tests)
│   ├── env.test.ts            # Constants, API base, sanitization (17 tests)
│   └── utils.test.ts          # Type guards (24 tests)
└── e2e/
    └── smoke.sh               # E2E smoke test (requires real API key + pi)
```

**Total: 132 unit tests across 8 files** (122 tests per summary; plus 10 from the earlier count evolution).

## Key File Roles

| File | Role |
|------|------|
| `src/index.ts` | Extension entry — receives `ExtensionAPI`, registers provider, wires error handler |
| `src/auth.ts` | Resolves API key from multiple sources; exports `walkClineProviderSettings` shared helper |
| `src/workos.ts` | All WorkOS-specific logic — token prefix, credential extraction, refresh protocol |
| `src/oauth.ts` | pi `/login` flow — auto-detect WorkOS credentials or manual paste |
| `src/models.ts` | Static model catalog (10 models) + dynamic model discovery with fallback |
| `src/error-handler.ts` | Error surface — filter → classify → deliver pipeline |
| `src/errors.ts` | Classification logic — maps API error messages to user-friendly messages |
| `src/env.ts` | Constants, environment variable resolution, API key sanitization |
| `src/utils.ts` | Shared type guards used across all modules |

## npm Package Contents

Defined by `"files"` in `package.json`:
- `src/` — all source modules
- `tests/` — test files
- `CHANGELOG.md`
- `README.md`
- `LICENSE`

Excluded by `.npmignore`:
- Source maps (`*.map`, `*.d.ts.map`)
- Build artifacts (`dist/`, `*.tsbuildinfo`)
- Git metadata (`.git/`, `.gitignore`, `.gitattributes`)
- CI config (`.github/`)
- Editor files (`.DS_Store`, `*.swp`, `*.swo`)
- Test internals (`tests/**/__snapshots__/`, `tests/**/fixtures/`)
- Documentation internals (`.planning/`, `doc/`)

## Naming Conventions

- **Files**: kebab-case (`error-handler.ts`, not `errorHandler.ts`)
- **Directories**: lowercase (`src/`, `tests/`)
- **Exports**: camelCase functions and types, SCREAMING_CASE constants
- **Test files**: `<module>.test.ts` in `tests/unit/`
- **Module JSDoc**: `@module clinepass-<module-name>` on every source file
