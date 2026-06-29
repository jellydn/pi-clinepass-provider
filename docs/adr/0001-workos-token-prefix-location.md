# ADR-0001: WorkOS Token Prefix Location

**Date:** 2026-06-30  
**Status:** Superseded (Option A accepted)

## Context

The string `"workos:"` identifies WorkOS OAuth access tokens in the codebase. It appears in two locations:

1. **`src/workos.ts`** — as the exported constant `WORKOS_TOKEN_PREFIX`, used by `isWorkosToken()` and `refreshWorkosToken()`.
2. **`src/auth.ts`** — as an inline string literal in `resolveApiKey()`, used to skip WorkOS OAuth tokens in the pi `auth.json` path.

The inline string in `auth.ts` is a potential maintainability concern — if the prefix ever changes, both locations must be updated.

## Decision Drivers

- **No circular imports**: `workos.ts` already imports `walkClineProviderSettings` and `defaultAuthPaths` from `auth.ts`. If `auth.ts` imported `WORKOS_TOKEN_PREFIX` from `workos.ts`, the dependency graph would become circular (`auth.ts → workos.ts → auth.ts`).
- **Minimize unnecessary churn**: The prefix is a stable WorkOS convention — it has never changed.
- **Consistent constant ownership**: `workos.ts` is the canonical owner of all WorkOS-specific knowledge.

## Options Considered

### Option A: Move constant to `env.ts`

Move `WORKOS_TOKEN_PREFIX` to `src/env.ts`, which both `auth.ts` and `workos.ts` already import. This eliminates the inline string without modifying the dependency graph.

**Files changed**: `env.ts` (add constant), `workos.ts` (import from env), `auth.ts` (import from env, replace inline string).  
**Pros**: Single source of truth. No circular dependency risk.  
**Cons**: Touches 3 files for a 7-character string. `env.ts` becomes a grab-bag of unrelated constants. The prefix is WorkOS-specific, not environment-specific — it's conceptually wrong to put it in `env.ts`.

### Option B: Keep inline in `auth.ts` with a comment (current)

**Files changed**: None.  
**Pros**: No unnecessary churn. Dependency graph unchanged. The inline string is documented with a comment referencing the guard.  
**Cons**: Two sources of truth. A future maintainer changing `WORKOS_TOKEN_PREFIX` in `workos.ts` must remember to also update `auth.ts`.

### Option C: Extract to a shared constants file (`src/constants.ts`)

Create a new `src/constants.ts` for shared constants used across modules. This avoids polluting `env.ts`.

**Files changed**: `constants.ts` (new), `auth.ts`, `workos.ts`.  
**Pros**: Clean separation. Single source of truth.  
**Cons**: New file for a single constant. Premature abstraction given the stable nature of the prefix.

## Decision

**Option A — Move constant to `env.ts` (accepted).** While Option B was the initial decision based on minimizing churn, the constant was moved to `env.ts` since both `auth.ts` and `workos.ts` already import from it. This eliminates the inline string without creating a circular dependency and without polluting `env.ts` (it already holds shared constants like `DEFAULT_API_BASE` and `PROVIDER_NAME`). The 7-character nature of the constant doesn't justify keeping it duplicated.

## Consequences

- **Positive**: Single source of truth for the prefix. No inline duplication. `workos.ts` re-exports from `env.ts` for backward compatibility (existing consumers like tests import from `workos.ts`).
- **Negative**: `env.ts` now holds a WorkOS-specific constant, which is conceptually a protocol detail rather than an environment concern. However, `env.ts` already holds the provider name and other shared constants.
- **Files changed**: `env.ts` (+2 lines), `auth.ts` (import + use constant), `workos.ts` (import from env + re-export).
