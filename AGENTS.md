# pi-clinepass-provider — Agent Guide

## Identity

pi extension that registers `"clinepass"` as a model provider via pi's `openai-completions` streaming. Entry point: `src/index.ts` (default export receiving `ExtensionAPI`).

Models are referenced as `clinepass/cline-pass/<slug>` (e.g. `clinepass/cline-pass/deepseek-v4-flash`). When invoking pi directly: `--model clinepass/cline-pass/...`.

## Implementation notes (all AI tools)

During any implementation work — pi, Cursor, Codex, Claude Code, OpenCode, or other agents — **append** to `.planning/implement-notes.md` whenever you hit a blocker, discover an issue, uncover a non-obvious finding, or learn something worth preserving for the next session.

- **When:** as soon as the item is known; do not defer to PR/merge time.
- **What:** blockers (cannot proceed), issues (bugs/gaps), findings (surprising behaviour), learnings (conventions, API quirks, test tricks).
- **How:** one dated entry per item; append under `## Entries` (newest at bottom). See the file header for the entry template.
- **Scope:** repo work only — no secrets, tokens, or personal data.

This file is the handoff trail between agents and humans. If you resolve an item later, add a follow-up line under the same entry rather than deleting it.

## Commands

| Command                 | What it does                                      |
| ----------------------- | ------------------------------------------------- |
| `npm test`              | Unit tests via Vitest                             |
| `npm run test:watch`    | Watch mode                                        |
| `npm run test:e2e`      | E2E smoke tests (requires `CLINE_API_KEY` + `pi`) |
| `npm run lint`          | Lint with oxlint (`--config .oxlintrc.json`)      |
| `npm run format`        | Format with oxfmt (in-place)                      |
| `npm run format:check`  | Check formatting without writing                  |
| `npm run typecheck`     | `tsc` (no emit via `tsconfig.json`)               |
| `npm run release`       | `bumpp` (prompts version, commits, tags, pushes)  |
| `npm run release:patch` | `bumpp patch`                                     |
| `npm run release:minor` | `bumpp minor`                                     |
| `npm run release:major` | `bumpp major`                                     |
| `npm run pub`           | `npm publish` (run after `release:*`)             |

`tsconfig.json` has `noEmit: true` — pi loads `.ts` source directly. No build step. `.npmignore` ensures clean publishes.

## Architecture

- **`src/index.ts`** — Entry. Calls `pi.registerProvider()`, wires models + OAuth + error handler.
- **`src/env.ts`** — Constants (`DEFAULT_API_BASE`, `ENV_API_KEY`, `PROVIDER_NAME`), `resolveApiBase()`, `sanitizeApiKey()`, `buildEndpointUrl()`.
- **`src/auth.ts`** — API key resolution chain: env var → `~/.cline/data/settings/providers.json` → `~/.pi/agent/auth.json`. Shared `walkAuthPaths()` / `walkClineProviderSettings()` utilities used by both auth and workos modules.
- **`src/models.ts`** — Static model definitions (10 curated models with pricing + thinking level maps) and dynamic model discovery (`fetchRemoteModels`, `resolveModels`). 5-second fetch timeout.
- **`src/workos.ts`** — WorkOS OAuth protocol adapter: credential extraction from providers.json and `~/.pi/agent/auth.json`, token refresh via Cline's `/api/v1/auth/refresh`, `isWorkosToken()` check.
- **`src/oauth.ts`** — `/login` flow: auto-detects existing WorkOS credentials, falls back to browser-assisted manual API key paste. `refreshToken()` delegates to WorkOS refresh or returns static key unchanged.
- **`src/error-handler.ts`** + **`src/errors.ts`** — `message_end` handler that classifies ClinePass 401/403/429 errors into user-friendly notifications.
- **`src/utils.ts`** — Type guards (`isRecord`, `stringValue`, `numberValue`, `booleanValue`).
- **`tests/type/contract.ts`** — Type-level contract: verifies the default export conforms to `ExtensionAPI` at compile time. Imported by `tsc` via `tsconfig.json` `include`.

## Testing

- **Unit tests** (`tests/unit/`) — Use dependency injection (`AuthKeyOptions`, `RemoteModelsOptions`, `WorkosRefreshOptions`). No FS or network. `vitest.config.ts` includes `tests/**/*.test.ts`. Run with `npm test`.
- **Type contract** (`tests/type/contract.ts`) — Verified by `npm run typecheck`. If pi changes `ExtensionAPI`, this fails at compile time.
- **E2E** (`tests/e2e/smoke.sh`) — Runs `pi --no-extensions -e <path>` with real `CLINE_API_KEY`. Requires `pi` CLI globally. CI runs only on `workflow_dispatch` with `run_e2e=true`.
- **Covered modules** — 1:1 test-to-module mapping (`env.test.ts`, `auth.test.ts`, `models.test.ts`, etc.).

## Key gotchas

- **Pre-commit hooks via prek** — `prek install` after clone; `prek run --all-files` to check manually. Runs `oxlint` + `oxfmt --check`.
- **Release flow** — `bumpp` handles version bump + commit + tag + push. Running `npm run release` prompts interactively. Then `npm run pub` (which runs `npm publish`, gated by `np` config). This is the only CI-trusted workflow.
- **Changesets** — `.changeset/` directory present; changeset files accumulate between releases.
- **Local dev** — `npm install` pulls peer deps (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`) automatically since they're in `devDependencies`.
- **WorkOS refresh nuances** — Cline's `/api/v1/auth/refresh` accepts `{granttype, refreshToken}` (no underscore in `granttype`). Response: `{data: {accessToken, refreshToken}}`. Access tokens need `workos:` prefix. Each refresh rotates the `refreshToken` — old one is single-use.
- **API key resolution priority** — explicit key arg → `CLINE_API_KEY` env var → `~/.cline/data/settings/providers.json` (static `apiKey` field) → `~/.pi/agent/auth.json`.
- **`CLINE_API_BASE`** env var overrides the API endpoint (default: `https://api.cline.bot`).
- **Model discovery** — at startup, fetches `/api/v1/models` (5s timeout). Falls back to static `MODELS` array on any error (network, 404, parse, empty list). Remote models without `cline-pass/` prefix are filtered out.
- **Lint** — `.oxlintrc.json` disables `unicorn/consistent-function-scoping` in test files. Uses `typescript`, `unicorn`, `oxc`, `import`, `jest` plugins.
- **`CONTEXT.md`** — Domain glossary (ClinePass, WorkOS OAuth, provider concepts). Source of truth for ubiquitous language.
