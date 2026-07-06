# Coding Conventions

**Analysis Date:** 2026-07-06

## Naming Patterns

**Files:**

- `kebab-case.ts` for source (`error-handler.ts`, `workos.ts`); one concern per file.
- `<module>.test.ts` for tests, mirroring src 1:1.
- `NNNN-kebab-case-title.md` for ADRs (zero-padded).

**Functions:**

- `camelCase` (`resolveApiKey`, `fetchRemoteModels`, `handleClinePassError`, `classifyClinePassError`).
- Boolean predicates: `is*` / `*Value` (`isRecord`, `isWorkosToken`, `stringValue`, `numberValue`, `booleanValue`).
- Resolvers/factories: `resolve*` / `credentialsFrom*` / `loginWith*` (`resolveApiBase`, `credentialsFromWorkos`, `loginWithManualApiKey`).

**Variables:**

- `camelCase` locals; `UPPER_SNAKE_CASE` for module-level constants (`DEFAULT_API_BASE`, `MODELS_FETCH_TIMEOUT_MS`, `WORKOS_REFRESH_MARGIN_MS`).

**Types:**

- `PascalCase` (`ModelConfig`, `AuthKeyOptions`, `ClineAuthCredentials`, `ThinkingLevelMap`).
- Union string types for enums: `ClinePassErrorType = "not_subscribed" | "auth_expired" | ...`.
- `Readonly<Record<K, V>>` for fixed-shape maps (`ThinkingLevelMap`).

## Code Style

**Formatting:**

- Tool: oxfmt (`.oxfmtrc.json`, empty `ignorePatterns` — defaults). Run `npm run format`; check via `npm run format:check`.
- Double quotes for strings. 2-space indentation. Trailing commas. Semis.

**Linting:**

- Tool: oxlint (`.oxlintrc.json`). Plugins: `typescript, unicorn, oxc, import, jest`. Categories: `correctness: error`, `suspicious: warn`.
- Test override (`.oxlintrc.json` `overrides`): `unicorn/consistent-function-scoping: off` in `tests/**/*.test.ts` (allows local helper functions).
- Env: `builtin: true`, `node: true`.
- Currently 0 warnings / 0 errors across 19 files.

**TypeScript:**

- `strict: true`, `noImplicitAny`, strict null checks, no unchecked indexed access. `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`. `skipLibCheck`, `esModuleInterop`, `forceConsistentCasingInFileNames`.

## Import Organization

**Order (observed in src modules):**

1. Node built-ins (`node:fs`, `node:os`, `node:path`).
2. External type imports (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`) — always `import type`.
3. Internal modules (`./env.js`, `./utils.js`, `./workos.js`).

**Path Aliases:**

- None. All imports are relative, using `.js` extensions (ESM; `moduleResolution: bundler` resolves to the `.ts` source).

**Notes:**

- `import type` is used consistently for type-only imports (`ExtensionAPI`, `OAuthCredentials`, `OAuthLoginCallbacks`).
- `workos.ts` re-exports `WORKOS_TOKEN_PREFIX` from `env.ts` for backward compatibility (ADR-0007).

## Error Handling

**Patterns:**

- **Pure classification:** `classifyClinePassError` (no I/O) returns `{ type, message }`; the handler in `error-handler.ts` owns delivery.
- **Graceful fallback:** `fetchRemoteModels` returns `undefined` on any error → `resolveModels` falls back to static `MODELS`. Never throws.
- **Typed throws:** `refreshWorkosToken` distinguishes `AbortError` (timeout → friendly message with `cause`) from other errors; non-OK responses throw with status + body + recovery hint. `loginWithManualApiKey` throws `"No ClinePass API key provided"` on empty input.
- **ENOENT suppression:** `walkAuthPaths` distinguishes "file absent" (silently skip) from "file corrupt" (`console.warn` with path + message, never contents).
- **No silent swallowing:** catch blocks either re-throw with context, return a fallback, or warn. The only bare `catch {}` is in `fetchRemoteModels` where `undefined` is the documented failure signal.

## Logging

**Framework:** None — `console.warn` / `console.error` directly.

**Patterns:**

- Prefix `[clinepass]` on all operator-facing logs.
- Security: never log file contents or resolved API keys. Auth-file warnings include only the path and the error message.
- Warn on recoverable degradation (corrupt auth file, short API key, WorkOS auto-login failure); error on the no-UI fallback path in `handleClinePassError`.

## Comments

**When to Comment:**

- Module-level: every `src/*.ts` opens with a JSDoc `@module clinepass-<name>` block describing the concern.
- "Why" comments for non-obvious decisions: the `granttype` (no underscore) Cline quirk, the `workos:` prefix enforcement, ENOENT vs corrupt-file distinction, the `String.fromCharCode` regex trick to dodge a lint rule.
- Section dividers: `// ─── Section Name ───────────` banners organize larger files (`models.ts`, `workos.ts`, `index.ts`).

**JSDoc/TSDoc:**

- All exports have JSDoc. Public functions document `@param` / `@returns`. Internal helpers marked `@internal` (e.g. `credentialsFromWorkos`).
- Inline doc on `pi.registerProvider` call site explains the `api: "openai-completions"` choice and the `compat`/`thinkingFormat` future-extension point.

## Function Design

**Size:** Files target < 300 lines (CONTRIBUTING.md). `models.ts` (412 lines) is the exception — see CONCERNS.md. Functions are short and single-purpose; deep modules with simple interfaces are preferred (ADR-0006).

**Parameters:**

- Injectable I/O via trailing options object: `AuthKeyOptions`, `RemoteModelsOptions`, `WorkosRefreshOptions`. Options default to real implementations (`process.env`, `readFileSync`, `globalThis.fetch`, `homedir()`).
- Higher-order extractors: `walkAuthPaths(options, extract)` and `walkClineProviderSettings(parsed, extract)` take a callback, eliminating duplication between static-key and WorkOS paths.

**Return Values:**

- `undefined` as a "not found / failure" signal (`resolveApiKey`, `fetchRemoteModels`, `resolveClineAuthCredentials`). Callers fall back, never throw on `undefined`.
- Readonly returns: `MODELS` is `readonly ModelConfig[]`; `resolveModels` returns `readonly ModelConfig[]`. Tuples `input: readonly ["text"]` are spread to mutable arrays at the registration boundary in `index.ts`.

## Module Design

**Exports:** Named exports for all functions/types/constants; the entry point (`src/index.ts`) is the sole `export default`. No barrel files — `index.ts` and `oauth.ts` import directly from the module that owns each concern (ADR-0006).

**Module structure (per CONTRIBUTING.md):**

1. `@module` JSDoc header.
2. Imports (node → external → internal).
3. Constants and types.
4. Private helpers.
5. Exported functions.

**Concern ownership:**

- `utils.ts` — type guards (leaf).
- `env.ts` — constants + env helpers.
- `models.ts` — model catalog + discovery.
- `auth.ts` — static key resolution + shared file-walking.
- `workos.ts` — all WorkOS protocol knowledge.
- `oauth.ts` — `/login` orchestration only (no protocol details).
- `errors.ts` — pure classification.
- `error-handler.ts` — filter/classify/deliver pipeline.

---

_Convention analysis: 2026-07-06_
