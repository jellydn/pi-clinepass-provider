# Codebase Concerns

**Analysis Date:** 2026-07-06

## Tech Debt

**`AGENTS.md` is stale (references deleted `src/logic.ts`):**

- Issue: The "Architecture" section of `AGENTS.md` describes the pre-refactor layout — it lists only 3 modules (`index.ts`, `logic.ts`, `oauth.ts`) and says the deleted `src/logic.ts` holds "Pure logic: model definitions, dynamic model discovery (`fetchRemoteModels`, `resolveModels`), API key resolution, WorkOS OAuth credential parsing (`resolveClineAuthCredentials`, `isWorkosToken`), sanitization, URL builder." That module was deleted in the ADR-0006 refactor and split into 6 modules (`env.ts`, `models.ts`, `auth.ts`, `workos.ts`, `errors.ts`, `utils.ts`), plus `error-handler.ts` was extracted — 7 of the 9 current `src/` modules are missing from the list. `isWorkosToken` and `resolveClineAuthCredentials` now live in `workos.ts`; `WORKOS_TOKEN_PREFIX` lives in `env.ts` (re-exported by `workos.ts` per ADR-0007). The `oauth.ts` entry is still accurate. The "Key gotchas" section is also still accurate (verified: `granttype` no-underscore, `workos:` prefix, single-use rotation, lint override all match current code).
- Files: `AGENTS.md` (lines 26-30, the Architecture section)
- Impact: Agents/contributors following AGENTS.md look for a non-existent `src/logic.ts` and get a wrong mental model of module ownership — 7 real modules are invisible to them. The other docs (CONTEXT.md, CONTRIBUTING.md, ADR-0006/0007, this map) are accurate.
- Fix approach: Rewrite the "Architecture" section of `AGENTS.md` to list the 9 actual `src/` modules and their responsibilities (mirror `.planning/codebase/STRUCTURE.md` / `ARCHITECTURE.md`). The "Key gotchas" section needs no change.

**`src/models.ts` exceeds the 300-line guideline:**

- Issue: CONTRIBUTING.md states "Files should stay under 300 lines. If a module grows beyond that, extract a sub-module." `models.ts` is 466 lines — driven by the 11-entry static `MODELS` catalog (each with a 6-level `thinkingLevelMap`) plus the dynamic-discovery logic.
- Files: `src/models.ts`
- Impact: Mild — the catalog is repetitive data, not complex logic; locality is still good. But it sets a precedent for ignoring the guideline as more models are added.
- Fix approach: Either (a) extract the static `MODELS` array into `src/models/static-catalog.ts` and keep `models.ts` for types + discovery, or (b) raise the guideline explicitly for data-table modules. Low priority; revisit when the catalog grows past ~15 models.

## Known Bugs

None known. All 147 unit tests pass; typecheck and lint are clean (verified 2026-07-06). Recent git history shows two related hardening fixes (`fix(oauth): harden WorkOS login when refresh token is stale`, `fix(oauth): fall back on any WorkOS auto-login error`) which appear resolved.

## Security Considerations

**Credential handling:**

- Risk: API keys and OAuth tokens are read from two filesystem locations and passed to pi. Mishandling could leak secrets in logs or error messages.
- Files: `src/auth.ts`, `src/workos.ts`, `src/oauth.ts`
- Current mitigation: `walkAuthPaths` explicitly never logs file contents or resolved keys — only the path and the error message on corrupt files. `sanitizeApiKey` strips terminal paste artifacts. Comments reinforce "Never log file contents or the resolved key."
- Recommendations: No change needed; the discipline is good. Consider a lint/test assertion that no `console.*` call site interpolates a key/token variable (currently true by inspection).

**WorkOS refresh token rotation (single-use):**

- Risk: WorkOS refresh tokens are single-use and rotated on each refresh. If a refresh succeeds on the server but the response is lost (network drop after 200), the old token is invalidated and the new one is never persisted — the user is silently logged out.
- Files: `src/workos.ts` `refreshWorkosToken`, `src/oauth.ts` `refreshToken`
- Current mitigation: `refreshWorkosToken` has a 15s timeout and throws on non-OK; `login()` falls back to manual paste on refresh failure. ADR-0005 already documents the single-use rotation risk thoroughly (Context, "Single-use rotation awareness" decision bullet, and "Token rotation fragility" in Negative Consequences — "a failed refresh (network error, crash) invalidates the existing refresh token. The user must re-run `cline auth` to recover."). The remaining gap is the mid-session case: pi-driven `refreshToken` failures (not login-driven) surface as an error with a recovery hint, but there's no automatic re-login prompt — the user must manually re-run `/login`.
- Recommendations: No doc change needed (ADR-0005 covers it). Optional: if pi's refresh-failure path could trigger a `/login` re-prompt automatically, that would close the mid-session recovery gap. Acceptable as-is for a client extension.

## Performance Bottlenecks

None significant. The extension is stateless after registration. Startup does one bounded `fetch` (5s timeout) for model discovery and reads at most two small JSON files — both are fast and failure-tolerant. Per-request work is owned by pi's `openai-completions` streaming, not this extension.

## Fragile Areas

**Dynamic model discovery vs static fallback:**

- Files: `src/models.ts` `fetchRemoteModels`, `resolveModels`
- Why fragile: The `/api/v1/models` endpoint currently returns 404, so the static `MODELS` array is the live path. The remote-parsing code path (OpenAI `{data:[...]}` vs bare array, pricing conversion, `cline-pass/` filtering, `DEFAULT_THINKING_LEVEL_MAP` vs `NO_THINKING_MAP` selection) is exercised only by mocked tests. When Cline ships the endpoint, real-world shape mismatches could surface.
- Safe modification: Keep the static catalog authoritative for `thinkingLevelMap` (remote models without a static fallback get the generic `DEFAULT_THINKING_LEVEL_MAP`, which may not match the upstream model's real reasoning tiers). When the endpoint goes live, validate a few real responses against the parser before relying on it.
- Test coverage: Good for the parsed cases (mocked); no coverage for real API shape drift.

**`thinkingLevelMap` group tests enumerate hardcoded IDs:**

- Files: `tests/unit/models.test.ts`
- Why fragile: Several tests list specific model IDs (`withoutXhigh`, `alwaysOn`, DeepSeek pair, GLM-5.2). Adding a model that belongs to one of these groups but isn't added to the test array will silently skip coverage for it.
- Safe modification: When adding a model, update the relevant array in `models.test.ts`. Consider deriving groups from a shared fixture to avoid drift.
- Test coverage: Adequate for current models; brittle to additions.

**`handleClinePassError` structural typing vs pi's handler signature:**

- Files: `src/error-handler.ts`, `src/index.ts`
- Why fragile: `pi.on("message_end", handleClinePassError)` relies on TypeScript structural typing for compatibility with pi's expected handler signature (noted in ADR-0006). The handler's `ctx` param is a structural subset, not the official pi type.
- Safe modification: If pi's `ExtensionHandler` type changes, the function signature may need adjustment. `tests/type/contract.ts` catches `ExtensionAPI` contract drift but may not catch handler-signature drift — verify the `on` registration still type-checks after pi upgrades.
- Test coverage: `index.test.ts` confirms the event is registered; `error-handler.test.ts` tests behavior directly.

## Scaling Limits

**Model catalog growth:**

- Current capacity: 11 static models, 466-line `models.ts`.
- Limit: No hard limit; each model adds ~25 lines. The 300-line guideline will be increasingly violated.
- Scaling path: Extract static catalog to its own module (see Tech Debt above) or move to a data file (JSON/TS data table) parsed at load.

**Auth file reading:**

- Current capacity: 2 fixed auth paths (`~/.cline/data/settings/providers.json`, `~/.pi/agent/auth.json`), walked per `resolveApiKey` call (startup) and per `resolveClineAuthCredentials` call (`/login`).
- Limit: Linear in number of auth paths (currently 2). No concern.

## Dependencies at Risk

**`@earendil-works/pi-ai` / `@earendil-works/pi-coding-agent` (peer deps):**

- Risk: These are the pi platform packages. Breaking contract changes would break the extension.
- Impact: Registration fails; `tests/type/contract.ts` fails at compile time (catches `ExtensionAPI` drift).
- Migration plan: CI matrix pins the minimum supported version (`0.80.2`) and tests latest on Node 22/24, so contract drift is caught early. Bump the peer dep range deliberately; update `package.json` `peerDependencies` + `devDependencies` together.

**oxlint / oxfmt (fast-moving, Rust-based):**

- Risk: These are relatively new tools with frequent releases; rule behavior could change.
- Impact: Lint/format CI could start failing on unchanged code.
- Migration plan: Renovate opens PRs for these; review carefully. `.oxlintrc.json` pins plugins and categories, limiting blast radius.

## Missing Critical Features

None for the extension's scope. The extension intentionally delegates streaming, tool calls, and usage tracking to pi's built-in `openai-completions` (ADR-0001) and delegates credential persistence to pi. No feature gaps identified.

## Test Coverage Gaps

**No coverage threshold / reporting:**

- What's not tested: Coverage is not measured. There's no `@vitest/coverage-*` dependency and no CI coverage gate.
- Files: `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`
- Risk: A new code path could land untested without a signal. Currently mitigated by the strong DI convention (everything is unit-testable) and the 1:1 test-to-source mapping.
- Priority: Low — the test suite is thorough (147 tests for 1234 src lines) and the DI pattern makes adding tests cheap.

**Test isolation: some auth tests don't inject `authPaths`/`homeDir`:**

- What's not tested (rather, what leaks): `tests/unit/auth.test.ts` "skips malformed auth.json" and `tests/unit/workos.test.ts` "returns undefined for malformed JSON" provide `readFile`/`fileExists` mocks but NOT `authPaths` or `homeDir`, so `walkAuthPaths` falls back to `defaultAuthPaths(homedir())` and constructs the real user's paths (`/Users/<user>/.cline/...`, `/Users/<user>/.pi/...`). The mocks intercept the I/O, but `console.warn` emits warnings referencing the real home directory (visible in test stderr).
- Files: `tests/unit/auth.test.ts`, `tests/unit/workos.test.ts`
- Risk: No functional risk (mocks intercept reads). Log noise in test output; tests are technically machine-dependent for path construction (would behave identically on any host, but the warnings are user-specific). Not a real failure mode.
- Priority: Low — inject `authPaths: ["/fake/..."]` and `homeDir: () => "/fake"` in those two tests to silence the noise and remove the user-path dependency.

**E2E not run in CI by default:**

- What's not tested in CI: Live API behavior (auth, streaming, model responses, error surfacing).
- Files: `.github/workflows/ci.yml`, `tests/e2e/smoke.sh`
- Risk: A regression that only manifests against the real Cline API (e.g. a response-shape change, a 403 message wording change) won't be caught by CI. Mitigated by `classifyClinePassError` pattern-matching being broad ("403"/"forbidden"/"subscription required"/"not subscribed").
- Priority: Medium — run `npm run test:e2e` manually before releases (per CONTRIBUTING.md). CI runs E2E only on manual `workflow_dispatch` with a secret.

**No contract test for the `message_end` handler signature:**

- What's not tested: `tests/type/contract.ts` asserts the default export conforms to `ExtensionAPI`, but does not assert `handleClinePassError` conforms to pi's `message_end` handler type (it uses a structural subset). A pi handler-type change could slip past `tsc`.
- Files: `tests/type/contract.ts`, `src/error-handler.ts`
- Risk: Low — the structural type is narrow and `index.test.ts` confirms registration.
- Priority: Low.

---

_Concerns audit: 2026-07-06_
