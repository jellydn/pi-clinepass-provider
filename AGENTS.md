# pi-clinepass-provider — Agent Guide

## Identity

pi extension that registers ClinePass as a model provider via pi's built-in `openai-completions` streaming. Entry point: `src/index.ts` (default export receiving `ExtensionAPI`).

## Commands

| Command                 | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `npm test`              | Unit tests via Vitest                              |
| `npm run test:watch`    | Watch mode                                         |
| `npm run test:e2e`      | E2E smoke tests (requires `CLINE_API_KEY` + `pi`)  |
| `npm run lint`          | Lint all source/test files with oxlint             |
| `npm run format`        | Format all source/test files with oxfmt (in-place) |
| `npm run format:check`  | Check formatting without writing                   |
| `npm run typecheck`     | TypeScript type checking (no emit via tsconfig)    |
| `npm run release`       | Bump version (prompt), commit, tag, push           |
| `npm run release:patch` | Bump patch version, commit, tag, push              |
| `npm run release:minor` | Bump minor version, commit, tag, push              |
| `npm run release:major` | Bump major version, commit, tag, push              |
| `npm run pub`           | Publish to npm (run after `release:*`)             |

`tsconfig.json` has `noEmit: true` — pi loads `.ts` source directly. No build step.

## Architecture

- **`src/index.ts`** — Extension entry. Calls `pi.registerProvider()`, wires models + OAuth + API base.
- **`src/logic.ts`** — Pure logic: model definitions, dynamic model discovery (`fetchRemoteModels`, `resolveModels` with static fallback), API key resolution (env var → `~/.cline/data/settings/providers.json` → `~/.pi/agent/auth.json`), WorkOS OAuth credential parsing (`resolveClineAuthCredentials`, `isWorkosToken`), sanitization, URL builder. All I/O parameterized for testability.
- **`src/oauth.ts`** — `/login` flow with two paths: (1) WorkOS OAuth — detects existing Cline CLI credentials from providers.json and refreshes via Cline's `/api/v1/auth/refresh` endpoint; (2) Static API key — browser-assisted manual paste. `refreshToken()` auto-detects WorkOS vs static keys.

## Testing

- Unit tests in `tests/unit/` use dependency injection (mock `readFile`, `fileExists`, `env`) — no FS or network. `vitest.config.ts` includes `tests/**/*.test.ts`.
- E2E tests (`tests/e2e/smoke.sh`) run `pi --no-extensions -e <provider_path>` with real API key. Requires `pi` globally installed and `CLINE_API_KEY` set.
- CI runs unit tests on `push`/`PR` to `main`; E2E only on `workflow_dispatch` with `run_e2e=true`.

## Install

```bash
# From npm (published to pi.dev/packages)
pi install npm:pi-clinepass-provider

# From git
pi install git:github.com/jellydn/pi-clinepass-provider

# Or local path
pi install /path/to/pi-clinepass-provider

# Quick test without installing
pi -e /path/to/pi-clinepass-provider
```

## Release

```bash
# 1. Bump version, commit, tag, push
npm run release          # prompts for version bump type
npm run release:patch    # 1.0.0 → 1.0.1
npm run release:minor    # 1.0.0 → 1.1.0
npm run release:major    # 1.0.0 → 2.0.0

# 2. Publish to npm (requires npm auth)
npm run pub
```

> `bumpp` handles version bumping, git commit, git tag, and git push.
> `np` is configured for extra safety checks (clean working tree, tests pass, etc.)
> but the simple `npm run release` + `npm run pub` flow works for most releases.

## Key gotchas

- **Pre-commit hooks via prek** — run `prek install` after cloning, or `prek run --all-files` to check manually.
- **Local dev setup:** `npm install` is sufficient — peer deps (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`) are in `devDependencies`.
- Module IDs use prefix `cline-pass/` (e.g. `cline-pass/deepseek-v4-flash`). When invoking pi, use `--model clinepass/cline-pass/...`.
- `CLINE_API_BASE` env var overrides the API endpoint (default: `https://api.cline.bot`).
- **WorkOS OAuth refresh** calls Cline's `/api/v1/auth/refresh` with `{granttype, refreshToken}` (note: `granttype` has no underscore). Response: `{data: {accessToken, refreshToken}}`. Access tokens need `workos:` prefix for the chat API.
- **Token refresh rotation**: each refresh returns a new `refreshToken` — the old one is single-use.
- Lint disables `unicorn/consistent-function-scoping` in test files (`.oxlintrc.json` override).
