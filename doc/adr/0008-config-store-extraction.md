# 8: Config-store extraction — shared store-traversal module

**Date:** 2026-07-01
**Status:** Accepted

## Context

During the god-module split (ADR-0006), the generic file-walking utilities `walkAuthPaths` and `walkClineProviderSettings` were placed in `src/auth.ts` because their primary consumer at the time was the key-resolution logic there. This created a subtle naming mismatch: `src/workos.ts` imported these generic store-traversal helpers from a module named `auth`:

```ts
// src/workos.ts — what does "auth" have to do with WorkOS?
import { walkAuthPaths, walkClineProviderSettings, type AuthKeyOptions } from "./auth.js";
```

A developer tracing the WorkOS credential extraction path would land on this import and have to dig into `auth.ts` to discover these were not authentication-specific functions — they are generic JSON-store traversal helpers shared by two consumers.

ADR-0006 assessed the `workos → auth` dependency as "clean" because it was acyclic (`utils → env → {models, auth, workos → auth}`). On re-examination, the lack of cycles is not the same as clarity — the dependency is semantically misleading even though it's directionally correct.

## Options Considered

### Option A: Extract to a new module (chosen)

Create `src/config-store.ts` owning the shared store-traversal boilerplate. Both `auth.ts` and `workos.ts` import from it directly.

**Files changed**: `config-store.ts` (new, ~90 lines), `auth.ts` (remove functions + add import, ~-80 lines), `workos.ts` (change import path), `config-store.test.ts` (new, ~130 lines), `auth.test.ts` (remove duplicated tests).

**Pros**: Module name communicates purpose. Removes cross-concern `workos → auth` dependency. No logic change — pure move. ADR-0006 stays valid for the original god-module split; this is a refinement.

**Cons**: New file for ~90 lines of shared code. Minor increase in module count (7 → 8 source files).

### Option B: Keep as-is with a comment

No structural change. Add a clarifying JSDoc comment to the import in `workos.ts` explaining why it depends on `auth.ts`.

**Pros**: Zero churn. No new files.

**Cons**: The naming mismatch persists. A comment documents the oddity but doesn't resolve it. The module name "auth" will still be the wrong place for a future developer adding a third store-traversal consumer.

### Option C: Inline in `workos.ts`

Duplicate `walkAuthPaths` and `walkClineProviderSettings` in `workos.ts` rather than importing from `auth.ts`.

**Pros**: `workos.ts` becomes self-contained. No new file needed.

**Cons**: Code duplication. The two implementations drift over time. The deletion test fails — removing the functions from `auth.ts` would not concentrate complexity, it would duplicate it.

## Decision

**Option A — Extract to `src/config-store.ts` (accepted).** The extraction is a pure mechanical move (~90 lines of unchanged logic) that removes the misleading `workos → auth` dependency and gives the store-traversal helpers an obvious home. The counter-argument from ADR-0006 ("moving them would require either duplicating or extracting") is resolved by extracting — no duplication needed.

## Consequences

### 📋 Positive

- **Clear module boundaries**: `config-store.ts` name communicates intent at a glance. No more guessing why `workos.ts` imports from `auth.ts`.
- **Removed cross-concern dependency**: `workos.ts` now depends on `config-store.ts`, `env.ts`, and `utils.ts` — no auth module involvement.
- **Pure mechanical change**: No new logic, no behaviour change, no test coverage loss (new `config-store.test.ts` has 15 dedicated tests).
- **Future-proofing**: A third consumer of store-traversal utilities — e.g. a credential migration module — would import from `config-store.ts` naturally.

### 📋 Negative

- **One more source file**: 8 source files vs. 7. Negligible in a codebase of this size.
- **ADR-0006 becomes slightly outdated**: The dependency graph documented there changed. The refinement section added to ADR-0006 keeps the original decision traceable.

### 📋 Files changed

- **Created**: `src/config-store.ts` (walkAuthPaths, walkClineProviderSettings, AuthKeyOptions, defaultAuthPaths)
- **Created**: `tests/unit/config-store.test.ts` (15 tests for the extracted functions)
- **Modified**: `src/auth.ts` (remove moved functions, add import from config-store.ts)
- **Modified**: `src/workos.ts` (change import path: auth.ts → config-store.ts)
- **Modified**: `tests/unit/auth.test.ts` (remove defaultAuthPaths test, now in config-store.test.ts)
- **Modified**: `doc/adr/0006-module-split-workos-adapter.md` (add refinement section)
