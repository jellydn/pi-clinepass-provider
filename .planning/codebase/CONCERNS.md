# CONCERNS.md — Technical Concerns

## Status Legend

- ✅ Resolved — issue has been addressed
- ⏳ Out of scope — accepted, not planned for current work
- 🔴 Open — needs attention

---

## Tech Debt

### 1. Model catalogue is hardcoded ⏳ Out of scope

**File:** `src/models.ts` → `MODELS` constant
**Details:** The static `MODELS` array (10 models) is the primary source. Dynamic discovery from `GET /api/v1/models` is implemented (`fetchRemoteModels`) but the endpoint currently returns 404. When Cline exposes it, discovery will work automatically. Until then, the list may drift from server-side changes.
**Recommendation:** Monitor Cline PR #11355 for endpoint availability. Consider adding a CI check that diffs the static list against the API response.

### 2. Qwen3.7 Plus tiered pricing ⏳ Out of scope

**File:** `src/models.ts` → `MODELS` → `cline-pass/qwen3.7-plus`
**Details:** Qwen3.7 Plus has tiered pricing based on context length. We use the ≤256K rate as default. Accurate per-request cost tracking would require runtime context-length detection.
**Recommendation:** Acceptable for usage tracking purposes.

### 3. Lint rule disabled in test files ⏳ Out of scope (minor)

**File:** `.oxlintrc.json`
**Details:** `unicorn/consistent-function-scoping` is disabled for test files because test helpers are intentionally local to each test file.
**Recommendation:** Acceptable. Each test file is self-contained.

---

## Known Bugs

_None currently open._

---

## Security Considerations

### 4. 10-year credential expiry assumption ⏳ Out of scope

**File:** `src/oauth.ts` → `credentialsFromApiKey()`
**Details:** Static API keys are given a 10-year expiry (`TEN_YEARS_MS`). Cline API keys may not have a defined expiry policy. If Cline rotates keys, the stored credential will persist until the 10-year mark or until the user re-runs `/login`.
**Recommendation:** On 401/403 from upstream, pi should treat the stored credential as invalid and prompt re-login. The `error-handler.ts` module surfaces a clear message, but doesn't automatically invalidate the credential.

### 5. API key visible in process environment ✅ Resolved

**File:** `src/auth.ts` → `resolveApiKey()`
**Details:** API keys are read from `CLINE_API_KEY` env var or auth files. Keys are never logged. Auth file read errors use `console.warn` with the file path only (no key content). The `sanitizeApiKey` function removes paste wrappers but doesn't log the input.
**Resolution:** Warning messages carefully avoid including key material. ENOENT errors are silently skipped; parse errors warn with path only.

---

## Performance Considerations

### 6. Synchronous filesystem reads ⏳ Out of scope (negligible)

**File:** `src/auth.ts` → `resolveApiKey()`, `src/workos.ts` → `resolveClineAuthCredentials()`
**Details:** Auth file reads use `readFileSync` during startup. This is a one-time blocking read of small JSON files (~1KB).
**Recommendation:** Negligible impact. Async reads would add complexity for no measurable benefit at startup.

### 7. Dynamic model fetch adds startup latency ✅ Resolved

**File:** `src/models.ts` → `fetchRemoteModels()`
**Details:** Remote model discovery adds a network request at startup.
**Resolution:** 5-second timeout via `AbortController` ensures startup is never blocked. Falls back to static `MODELS` on timeout, error, or 404.

---

## Fragile Areas

### 8. Cline CLI config-schema dependency ✅ Resolved (partial)

**File:** `src/workos.ts` → `resolveClineAuthCredentials()`
**Details:** Parsing depends on the Cline CLI's `providers.json` structure (`providers["cline-pass"].settings.{apiKey,auth}`). If Cline changes this format, credential detection breaks silently.
**Resolution:** Defensive parsing with `isRecord()` type guards at every level. Falls back to other auth methods (env var, pi auth.json) on parse failure. Added edge-case tests for missing/malformed fields.

### 9. Error message pattern matching ✅ Resolved

**File:** `src/errors.ts` → `classifyClinePassError()`
**Details:** Error classification relies on substring matching of error messages (e.g., "403", "forbidden", "rate limit"). If Cline changes error message format, classification may fall through to "unknown".
**Resolution:** Multiple patterns per error type (HTTP status code + keywords). "unknown" fallback still surfaces a helpful generic message. 14 test cases cover all patterns.

---

## Scaling Limits

### 10. No live model/pricing discovery ⏳ Out of scope (planned future work)

**File:** `src/models.ts` → `MODELS`
**Details:** Model list and pricing are hardcoded. New models added by Cline require a code update.
**Recommendation:** Dynamic discovery is implemented and ready — it will activate automatically when Cline exposes `GET /api/v1/models`. The endpoint is confirmed by Cline PR #11355.

### 11. Rate limits uninstrumented ⏳ Out of scope

**File:** `src/error-handler.ts`, `src/errors.ts`
**Details:** ClinePass has 2-5x API rate limits. Rate limit (429) errors are classified and surfaced to the user, but there's no proactive rate limit tracking or backoff.
**Recommendation:** Pi's built-in retry logic handles transient 429s. Proactive tracking would require custom `streamSimple` which contradicts the "use built-in openai-completions" design.

---

## Dependencies at Risk

### 12. pi-ai and pi-coding-agent pre-1.0 ✅ Resolved

**File:** `package.json`
**Details:** Both peer dependencies are pre-1.0 (`^0.80.2`), meaning breaking changes are possible in minor versions.
**Resolution:** Peer deps constrained to `>=0.80 <0.90`. CI matrix tests against minimum supported version (0.80.2) to catch contract drift. `engines.node: ">=22"` and `@types/node: "^22"` are aligned.

---

## Missing Features (Future Work)

### 13. No live model/pricing discovery from API ⏳ Out of scope

**File:** `src/models.ts`
**Details:** The Cline API `GET /api/v1/models` endpoint is not yet publicly available (returns 404). Dynamic discovery code is implemented and ready.
**Recommendation:** Monitor Cline releases for endpoint availability. Confirmed by Cline PR #11355.

### 14. No diagnostics/logging surface ✅ Resolved (partial)

**File:** `src/error-handler.ts`, `src/oauth.ts`, `src/workos.ts`
**Details:** The extension uses `console.warn` for non-fatal warnings and `ctx.ui.notify()` / `console.error` for error surfacing. There's no structured logging or debug mode.
**Resolution:** Warning messages are prefixed with `[clinepass]` for easy identification. Error handler surfaces user-friendly classified messages. Structured logging would require pi platform support.

---

## Summary

| Status          | Count  |
| --------------- | ------ |
| ✅ Resolved     | 7      |
| ⏳ Out of scope | 7      |
| 🔴 Open         | 0      |
| **Total**       | **14** |
