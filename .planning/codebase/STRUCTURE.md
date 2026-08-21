# Codebase Structure

**Analysis Date:** 2026-07-06

## Directory Layout

```
pi-clinepass-provider/
├── src/                      # Extension source (loaded directly by pi, no build)
│   ├── index.ts              # Entry point — registers provider + error handler
│   ├── env.ts                # Constants + env helpers (resolveApiBase, sanitizeApiKey)
│   ├── utils.ts              # Pure type guards (isRecord, stringValue, ...)
│   ├── models.ts             # Static MODELS catalog + dynamic discovery
│   ├── auth.ts               # Static API key resolution + shared file-walking helpers
│   ├── workos.ts             # WorkOS protocol adapter (prefix, refresh, extraction)
│   ├── oauth.ts              # /login orchestration (WorkOS auto + manual paste)
│   ├── errors.ts             # Pure error classification + message table
│   └── error-handler.ts      # message_end handler: filter → classify → deliver
├── tests/
│   ├── unit/                 # 9 *.test.ts files, 1:1 with src modules
│   ├── type/                 # contract.ts — compile-time ExtensionAPI conformance
│   └── e2e/                  # smoke.sh — live API tests (needs CLINE_API_KEY)
├── doc/
│   └── adr/                  # ADR-0000..0007 (template + 7 decisions)
├── .changeset/               # Pending changeset (patch: thinking-level off→none)
├── .github/workflows/        # ci.yml (matrix tests + optional e2e)
├── .planning/                # Generated codebase map + planning artifacts
├── package.json              # Scripts, peer/dev deps, pi.extensions entry
├── tsconfig.json             # strict, noEmit, ES2022
├── vitest.config.ts          # tests/**/*.test.ts
├── .oxlintrc.json            # lint config (test override for unicorn scoping)
├── .oxfmtrc.json             # format config
├── prek.toml                 # pre-commit hooks (oxlint, oxfmt, builtin checks)
├── renovate.json             # Dep automation
├── AGENTS.md                 # Agent-facing guide (NOTE: stale — see CONCERNS)
├── CONTEXT.md                # Domain glossary (ClinePass terminology)
├── CONTRIBUTING.md           # Dev setup + conventions
├── CHANGELOG.md              # Release history
├── RELEASE_CHECKLIST.md      # Release procedure
└── README.md                 # User-facing docs
```

## Directory Purposes

**`src/`:**

- Purpose: All extension source. 9 modules, 1234 lines total. Loaded directly by pi (no build).
- Contains: `.ts` modules only.
- Key files: `index.ts` (entry), `models.ts` (412 lines — largest), `workos.ts` (247), `auth.ts` (166), `oauth.ts` (141).

**`tests/unit/`:**

- Purpose: Vitest unit tests with dependency injection (no FS/network).
- Contains: 9 `*.test.ts` files mirroring `src/` 1:1. 147 tests total.
- Key files: `workos.test.ts` (361 lines), `models.test.ts` (337), `oauth.test.ts` (320).

**`tests/type/`:**

- Purpose: Compile-time contract test. NOT a `.test.ts` file (so Vitest skips it); validated by `tsc`.
- Key files: `contract.ts` (16 lines).

**`tests/e2e/`:**

- Purpose: Live smoke tests against Cline's API.
- Key files: `smoke.sh` (169 lines) — auth check, 4 model prompts, invalid-key/invalid-model cases.

**`doc/adr/`:**

- Purpose: Architecture Decision Records. Context → Drivers → Options → Decision → Consequences.
- Key files: `0000-adr-template.md`, `0001-use-openai-completions-streaming.md`, `0002-pure-logic-ioc-separation.md`, `0003-dual-auth-flow.md`, `0004-dynamic-model-discovery.md`, `0005-workos-token-refresh.md`, `0006-module-split-workos-adapter.md`, `0007-workos-token-prefix-location.md`.

**`.planning/`:**

- Purpose: Generated codebase map (this directory) + prior planning artifacts (`architecture-review.html`).
- Generated: Yes (by the codemap skill). Committed: Yes.

## Key File Locations

**Entry Points:**

- `src/index.ts`: Default export `async function (pi: ExtensionAPI)` — registers the `clinepass` provider.
- `package.json` `pi.extensions`: `["./src/index.ts"]` — pi's pointer to the entry.

**Configuration:**

- `package.json`: Scripts, `engines.node >= 22`, peer/dev deps, `np` release config, `pi.extensions`.
- `tsconfig.json`: `strict`, `noEmit`, `moduleResolution: bundler`, `include: [src/**/*.ts, tests/**/*.ts]`.
- `vitest.config.ts`: `test.include: ["tests/**/*.test.ts"]` — excludes `tests/type/contract.ts`.
- `.oxlintrc.json` / `.oxfmtrc.json`: lint/format.
- `prek.toml`: pre-commit hooks.

**Core Logic:**

- `src/models.ts`: Model catalog + discovery (the largest, most central module).
- `src/workos.ts`: WorkOS protocol (refresh, extraction, prefix).
- `src/auth.ts`: Static key resolution + shared `walkAuthPaths`/`walkClineProviderSettings`.

**Testing:**

- `tests/unit/*.test.ts`: Unit tests (DI-mocked).
- `tests/type/contract.ts`: Type contract.
- `tests/e2e/smoke.sh`: E2E.

## Naming Conventions

**Files:**

- Source: `kebab-case.ts` (`error-handler.ts`, `workos.ts`). One concern per file.
- Tests: `<module-name>.test.ts` matching the src module 1:1 (`auth.test.ts` ↔ `auth.ts`).
- ADRs: `NNNN-kebab-case-title.md` (zero-padded 4 digits).

**Directories:**

- `kebab-case` for multi-word (none currently in src/); `unit`/`type`/`e2e` for test tiers.

**Identifiers:**

- Constants: `UPPER_SNAKE_CASE` (`DEFAULT_API_BASE`, `WORKOS_TOKEN_PREFIX`).
- Functions: `camelCase` (`resolveApiKey`, `fetchRemoteModels`).
- Types/interfaces: `PascalCase` (`ModelConfig`, `AuthKeyOptions`, `ClineAuthCredentials`).
- Module IDs: `cline-pass/<slug>` (model IDs); provider name `clinepass` (no hyphen). Full pi model ref: `clinepass/cline-pass/<slug>`.

## Where to Add New Code

**New model:**

- Add a `ModelConfig` entry to the `MODELS` array in `src/models.ts`. Declare all 6 thinking levels. ID must start with `cline-pass/`.
- Tests: extend `tests/unit/models.test.ts` (the "always-reasoning"/"without-xhigh" group tests enumerate specific IDs — update if the new model fits a group).

**New auth source / credential format:**

- Extraction logic: `src/auth.ts` (static keys) or `src/workos.ts` (WorkOS creds). Add a path to `defaultAuthPaths` if it's a new file location.
- Tests: `tests/unit/auth.test.ts` / `tests/unit/workos.test.ts` with injected `readFile`/`fileExists`.

**New error category:**

- Add to `ClinePassErrorType` + `CLINEPASS_ERROR_MESSAGES` in `src/errors.ts`, and a pattern branch in `classifyClinePassError`.
- Tests: `tests/unit/errors.test.ts` + `tests/unit/error-handler.test.ts`.

**New utility / shared helper:**

- Pure type guards → `src/utils.ts`. Constants/env helpers → `src/env.ts`. Avoid new modules unless a distinct concern emerges (per ADR-0006's split philosophy; keep files < 300 lines).

**New ADR:**

- Copy `doc/adr/0000-adr-template.md` to `doc/adr/NNNN-*.md` (next number). Follow the Context → Drivers → Options → Decision → Consequences format.

## Special Directories

**`node_modules/`:**

- Purpose: Dependencies. Generated by `npm install`. Committed: No (gitignored).

**`.planning/`:**

- Purpose: Generated codebase map + planning artifacts. Generated: Yes. Committed: Yes.

**`.changeset/`:**

- Purpose: Pending changesets for release notes. Generated: by changeset tooling. Committed: Yes.

---

_Structure analysis: 2026-07-06_
