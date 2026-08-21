# Technology Stack

**Analysis Date:** 2026-07-06

## Languages

**Primary:**

- TypeScript `^6.0.3` — all source (`src/*.ts`) and tests (`tests/**/*.ts`). Strict mode enabled.

**Secondary:**

- Bash — `tests/e2e/smoke.sh` E2E smoke-test driver (real API calls via `pi` + `curl`).

## Runtime

**Environment:**

- Node.js `>= 22` (enforced via `package.json` `engines`). CI matrix tests Node 22 (min supported) and Node 24.

**Package Manager:**

- npm (lockfile: `package-lock.json`, committed). `npm ci` used in CI.
- No pnpm/yarn support configured (`np` release config disables both).

## Frameworks

**Core:**

- `@earendil-works/pi-ai` `^0.80.2` — pi's AI types (`OAuthCredentials`, `OAuthLoginCallbacks`). Peer + dev dependency.
- `@earendil-works/pi-coding-agent` `^0.80.2` — pi's `ExtensionAPI` contract that the extension's default export receives. Peer + dev dependency.

**Testing:**

- Vitest `^4.1.5` — unit test runner. Config: `vitest.config.ts` (glob `tests/**/*.test.ts`).

**Build/Dev:**

- TypeScript `^6.0.3` — type checking only. `tsconfig.json` has `noEmit: true`; **no build step**. pi loads `.ts` source directly.
- oxlint `^1.71.0` — linter (Rust-based, oxc). Config: `.oxlintrc.json`.
- oxfmt `^0.57.0` — formatter. Config: `.oxfmtrc.json`.
- prek — pre-commit hook runner. Config: `prek.toml` (trailing-whitespace, eof-fixer, large-files, json/toml/yaml checks + local oxlint/oxfmt hooks).
- bumpp `^11.1.0` — version bumping for releases (`npm run release:*`).
- np `^11.2.1` — npm publish safety wrapper (`npm run pub`).
- all-contributors-cli `^6.26.1` — contributor management.

## Key Dependencies

**Critical:**

- `@earendil-works/pi-coding-agent` — defines `ExtensionAPI`, the contract the entry point implements. A breaking change here fails `tests/type/contract.ts` at compile time.
- `@earendil-works/pi-ai` — defines `OAuthCredentials` / `OAuthLoginCallbacks` used by `src/oauth.ts` and `src/workos.ts`.

**Infrastructure:**

- No runtime dependencies. `package.json` has no `dependencies` field — everything is `devDependencies` or `peerDependencies`. The published package is pure TypeScript loaded by pi.

## Configuration

**Environment:**

- `CLINE_API_KEY` — ClinePass API key (static). Highest-priority auth source. Referenced via sigil `$CLINE_API_KEY` in `pi.registerProvider`.
- `CLINE_API_BASE` — overrides the API endpoint (default `https://api.cline.bot`). Normalized in `src/env.ts` `resolveApiBase` (trim + strip trailing slashes).
- Auth files (no env var): `~/.cline/data/settings/providers.json` (Cline CLI), `~/.pi/agent/auth.json` (pi OAuth store).

**Build:**

- `tsconfig.json` — `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `strict: true`, `noEmit: true`, `lib: [ES2022]`, `types: [node]`. Includes `src/**/*.ts` and `tests/**/*.ts`.
- `vitest.config.ts` — `test.include: ["tests/**/*.test.ts"]`.
- `.oxlintrc.json` — plugins: `typescript, unicorn, oxc, import, jest`; `correctness: error`, `suspicious: warn`; test override disables `unicorn/consistent-function-scoping`.
- `.oxfmtrc.json` — empty `ignorePatterns` (default formatting).
- `prek.toml` — builtin hooks + local `oxlint` / `oxfmt --check` hooks on JS/TS/JSON/MD/YAML.
- `renovate.json` — automated dependency updates.
- `package.json` `pi.extensions: ["./src/index.ts"]` — tells pi where the entry point is.

## Platform Requirements

**Development:**

- Node.js >= 22, npm >= 10. `mise` recommended for `prek` (`mise install prek`). Run `prek install` after cloning.

**Production:**

- Distributed as an npm package (`pi-clinepass-provider`) consumed by the pi coding agent. No server/deployment — it's a client-side extension loaded into pi's process. Published via `npm run release:*` + `npm run pub`.

---

_Stack analysis: 2026-07-06_
