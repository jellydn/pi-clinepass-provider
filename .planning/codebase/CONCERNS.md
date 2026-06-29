# CONCERNS.md — Technical Concerns

## Overview

The codebase is in excellent health after a series of refactors (provider traversal extraction, `sanitizeApiKey` hardening, WorkOS token guard, error-handler JSDoc restoration). No critical, high, or medium-severity issues remain. The items below are classified by nature: **tooling constraints**, **dependency inversion trade-offs**, **coverage gaps**, and **forward-looking notes**.

---

## Coverage Gaps

### 2. No integration-level test coverage in CI

**File**: `.github/workflows/`  
**Issue**: E2E smoke tests only run on `workflow_dispatch` with `run_e2e=true` — not on every PR.  
**What 132 unit tests DON'T cover**:
- `pi.registerProvider()` contract — does pi actually accept the registration shape we produce? DI tests bypass the real pi runtime.
- WorkOS refresh protocol — does it work against a live Cline API endpoint? Mocked `fetch` bypasses real HTTP.
- `/login` flow end-to-end — browser open → paste → credential store. Entirely mocked.
- Model discovery against a live endpoint — real JSON parsing, real HTTP errors, real timeouts.
**Reason**: Real `CLINE_API_KEY` cannot be stored in CI secrets for public repositories.  
**Mitigation**: Unit test coverage is comprehensive for internal logic (132 tests across 8 files, all I/O is injectable). E2E run manually before releases.

---

## Forward-Looking

### 3. Model compatibility overrides not yet exercised

**File**: `src/index.ts:20-24`  
**Issue**: The `compat` / `thinkingFormat` override mechanism is documented but no model currently uses it — all models rely on pi's default `openai-completions` handling for reasoning.  
**Forward plan**: Monitor user feedback on reasoning quality for individual models. Add `compat` overrides only if specific models show issues through the live API.

### 4. ~~No TypeScript type-level tests for pi SDK interface~~

**Resolved** — `tests/type/contract.ts` added: a compile-time type assertion that our default export conforms to pi's `(api: ExtensionAPI) => Promise<void>` contract. Named without `.test` suffix so vitest skips it; `tsconfig.json`'s `include: ["tests/**/*.ts"]` picks it up for type-checking.

---

## No Active Concerns

- ✅ No TODO/FIXME/HACK comments in source code
- ✅ No files over 250 lines
- ✅ No circular dependencies
- ✅ No `any` type assertions or unsafe casts
- ✅ All modules have `@module` JSDoc
- ✅ All exported functions have JSDoc
- ✅ 132 unit tests, all passing
- ✅ TypeScript strict mode, no errors
- ✅ Lint: 0 errors, 0 warnings
- ✅ Format: consistent via oxfmt

---

## Historical (Previously Resolved)

These were findings from prior thermo-nuclear reviews, now fully addressed:

- ✅ **Finding 1** — Duplicated provider traversal eliminated via `walkClineProviderSettings` helper
- ✅ **Finding 2** — Module-level `@module clinepass-error-handler` JSDoc restored
- ✅ **Finding 3** — WorkOS token leak guarded in `resolveApiKey` (skips `workos:`-prefixed values)
- ✅ `sanitizeApiKey` control character filtering simplified (settled on split/filter/join due to lint)
- ✅ `buildEndpointUrl` JSDoc added (was the only export without one)
