# Contributing to pi-clinepass-provider

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Dev Setup

```bash
# Clone and install
git clone https://github.com/jellydn/pi-clinepass-provider.git
cd pi-clinepass-provider
npm install

# Install pre-commit hooks (enforces lint + format)
prek install
```

> **Note:** `prek` is a global tool (via [mise](https://mise.jdx.dev)) that runs lint and format checks. Install it with `mise install prek` if not already available.

**Requirements:** Node.js >= 22, npm >= 10.

Peer dependencies (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`) are in `devDependencies` — `npm install` pulls them automatically.

No build step. Pi loads `.ts` source directly (`tsconfig.json` has `noEmit: true`).

## Commands

| Command                | Purpose                                 |
| ---------------------- | --------------------------------------- |
| `npm test`             | Run unit tests via Vitest               |
| `npm run test:watch`   | Run tests in watch mode                 |
| `npm run test:e2e`     | E2E smoke tests (needs `CLINE_API_KEY`) |
| `npm run lint`         | Lint all files with oxlint              |
| `npm run format`       | Auto-format all files with oxfmt        |
| `npm run format:check` | Check formatting without writing        |
| `npm run typecheck`    | TypeScript strict mode check            |

Run `prek run --all-files` before pushing to run the full pre-commit suite.

## Coding Conventions

### TypeScript

- **Strict mode** is enabled — strict null checks, no implicit `any`, no unchecked indexed access, no unsafe casts.
- All exports have JSDoc comments (`@param`, `@returns`, `@module` for modules).
- Use `unknown` at I/O boundaries (JSON parse, API responses), guarded by type predicates (`isRecord`, `stringValue`) before use.
- Prefer `readonly` arrays and `const` over `let`.

### Architecture

- **Dependency injection via options objects** — all I/O (file reading, fetching, env vars) is injectable through interfaces like `AuthKeyOptions`, `RemoteModelsOptions`, `WorkosRefreshOptions`. This makes every function testable without mocking globals.
- **Shared abstractions** live in their canonical module:
  - `src/auth.ts` — file-walking helpers (`walkAuthPaths`, `walkClineProviderSettings`)
  - `src/workos.ts` — WorkOS protocol knowledge (token prefix, refresh, credential extraction)
  - `src/env.ts` — shared constants and environment helpers
  - `src/utils.ts` — pure type guards (`isRecord`, `stringValue`, `numberValue`, `booleanValue`)
- **No circular dependencies** between modules.
- **No feature logic leaking into shared paths** — each module owns a single concern.

### Module Structure

Each source module follows this pattern:

```typescript
/**
 * Module description.
 * @module clinepass-<name>
 */

// 1. Imports (node built-ins → external → internal)

// 2. Constants and types

// 3. Pure helpers (private)

// 4. Exported functions
```

Files should stay under 300 lines. If a module grows beyond that, extract a sub-module into its own file.

## Testing

### Unit Tests

- Tests live in `tests/unit/*.test.ts`, matched by Vitest's `tests/**/*.test.ts` glob.
- **Every I/O surface is injectable** — tests use `AuthKeyOptions` / `RemoteModelsOptions` with mock `readFile`, `fileExists`, `fetch`, and `env` instead of touching the filesystem or network.
- **Comprehensive unit tests** — run with `npm test`.

Example:

```typescript
const key = resolveApiKey(undefined, {
  env: { CLINE_API_KEY: "test-key" },
  authPaths: [],
});
expect(key).toBe("test-key");
```

### Type Contract Tests

`tests/type/contract.ts` is a compile-time assertion that our default export conforms to pi's `(api: ExtensionAPI) => Promise<void>` contract. If pi changes the contract in a breaking way, TypeScript will error here — catching the mismatch at build time rather than runtime.

This file intentionally does NOT use the `.test.ts` suffix so Vitest skips it.

### E2E Smoke Tests

`tests/e2e/smoke.sh` tests against a live Cline API. Requires:

- `CLINE_API_KEY` environment variable
- `pi` installed globally

Run manually before releases (CI can't hold private API keys for public repos):

```bash
CLINE_API_KEY=your_key npm run test:e2e
```

## Pull Request Process

1. **Create a branch** from `main`: `feat/description`, `fix/description`, `docs/description`, `refactor/description`.
2. **Make changes** following the coding conventions above.
3. **Verify locally**: `npm test && npm run typecheck && npm run lint && npm run format:check`.
4. **Push** and open a draft PR.
5. **CI runs unit tests + typecheck + lint automatically** on every push.
6. **Request review** when ready. Address feedback, then merge (squash preferred).

### Commit Conventions

Follow [conventional commits](https://www.conventionalcommits.org/):

```text
type(scope): description

- bullet points for details
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.

Each commit should be atomic — one logical change per commit, staged explicitly (no `git add -A`).

## Documentation

- **ADR** — Architecture Decision Records in `doc/adr/`. Use for significant design decisions. Follow the existing format: Context → Decision Drivers → Options → Decision → Consequences.
- **CONCERNS.md** — `.planning/codebase/CONCERNS.md` tracks remaining technical concerns and coverage gaps.
- **CONTEXT.md** — domain glossary of ClinePass-specific terms.
- **AGENTS.md** — agent-facing guide (architecture overview, commands, gotchas).
- **`.plans/implement-notes.md`** — append-only implementation log (blockers, issues, findings, learnings) for all AI tools; see AGENTS.md.

## Questions?

Open an issue or discussion on GitHub.
