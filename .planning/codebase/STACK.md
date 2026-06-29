# STACK.md — Technology Stack

## Language & Runtime

| Component | Version / Detail |
|-----------|-----------------|
| **Language** | TypeScript 6.x |
| **Runtime** | Node.js ≥ 22 |
| **Module system** | ESM (`"type": "module"`) |
| **Target** | ES2022 |
| **Module resolution** | `bundler` |
| **Type checking** | `strict: true`, `noEmit: true`, `skipLibCheck: true` |

No build step — pi loads `.ts` source directly. `tsconfig.json` uses `noEmit: true` (type checking only).

## Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@earendil-works/pi-ai` | `^0.80.2` | pi AI SDK — `OAuthCredentials`, `OAuthLoginCallbacks` types |
| `@earendil-works/pi-coding-agent` | `^0.80.2` | pi coding agent SDK — `ExtensionAPI` entry point |

Both are **peer dependencies** (the pi runtime provides them) and **dev dependencies** (for local development and type checking).

No runtime dependencies beyond Node.js built-ins (`node:fs`, `node:os`, `node:path`).

## Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | `^4.1.5` | Test runner and assertion library |
| `typescript` | `^6.0.3` | TypeScript compiler (type checking only) |
| `oxlint` | `^1.71.0` | Linter (ESLint-compatible, with TypeScript + unicorn + import + jest plugins) |
| `oxfmt` | `^0.56.0` | Formatter (Biome-compatible) |
| `bumpp` | `^11.1.0` | Automated version bumping + git tag + push |
| `np` | `^11.2.1` | npm publish safety checks (clean tree, tests pass) |
| `@types/node` | `^24.0.0` | Node.js type definitions |

## Tooling Configuration

| Tool | Config File | Notes |
|------|-----------|-------|
| TypeScript | `tsconfig.json` | Strict mode, ES2022 target, bundler module resolution |
| Linter | `.oxlintrc.json` | Typescript + unicorn + oxc + import + jest plugins; `correctness: error`, `suspicious: warn`; `unicorn/consistent-function-scoping` disabled in tests |
| Formatter | `.oxfmtrc.json` | Minimal config (no ignore patterns) |
| Tests | `vitest.config.ts` | Includes `tests/**/*.test.ts` only |
| Pre-commit | `prek.toml` | Trailing whitespace, EOF, large files, JSON/TOML/YAML validation, oxlint, oxfmt |

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `test` | `vitest run` | Run all unit tests |
| `test:watch` | `vitest` | Watch mode for development |
| `test:e2e` | `bash tests/e2e/smoke.sh` | E2E smoke test (requires `CLINE_API_KEY` + `pi`) |
| `lint` | `oxlint --config .oxlintrc.json src/ tests/` | Lint all source and test files |
| `format` | `oxfmt --write src/ tests/` | Format in-place |
| `format:check` | `oxfmt --check src/ tests/` | Check formatting without writing |
| `typecheck` | `tsc` | TypeScript type checking (no emit) |
| `release` | `bumpp --commit --push --tag` | Bump version (interactive prompt) |
| `release:patch` | `bumpp --commit --push --tag patch` | Bump patch version |
| `release:minor` | `bumpp --commit --push --tag minor` | Bump minor version |
| `release:major` | `bumpp --commit --push --tag major` | Bump major version |
| `pub` | `npm publish` | Publish to npm |

## npm Publishing

| Field | Value |
|-------|-------|
| Package name | `pi-clinepass-provider` |
| Version | `1.0.1` |
| License | MIT |
| Entry point | `src/index.ts` |
| Included files | `src/`, `tests/`, `CHANGELOG.md`, `README.md`, `LICENSE` |
| Excluded (via `.npmignore`) | Source maps, build artifacts, `.git/`, `.github/`, `.planning/`, `doc/`, editor files |
| Required engines | Node ≥ 22 |
| Publish tool | `np` (with release draft, test script, main branch enforce) |

## Packages Provided

The `"pi"` field in `package.json` registers `./src/index.ts` as a pi extension entry point.
