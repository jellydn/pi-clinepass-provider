# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] — 2026-07-15

### Fixed

- **Developer role rejected by ClinePass API** — set `compat.supportsDeveloperRole: false` on all models so pi sends `system` instead of `developer`, fixing 400 errors on GLM-5.2 and other ClinePass models ([#31](https://github.com/jellydn/pi-clinepass-provider/issues/31))

## [1.0.6] — 2026-07-06

### Fixed

- **Thinking level `off` mapping** — map pi's `off` thinking level to ClinePass `reasoning.effort: "none"` instead of `"off"`, fixing 400 errors on GLM 5.2 and other models when thinking is disabled ([#17](https://github.com/jellydn/pi-clinepass-provider/issues/17))

## [1.0.2] — 2026-06-30

### Added

- **`walkClineProviderSettings` helper** — shared traversal extracted from `auth.ts` and `workos.ts` to eliminate duplicated `providers["cline-pass"|"cline"].settings` iteration with `isRecord` chains (~25 lines of duplication eliminated)
- **JSDoc to `buildEndpointUrl`** — was the only exported function without a doc comment; now consistent with all other exports
- **Module-level JSDoc restoration** — `@module clinepass-error-handler` re-added to `error-handler.ts` describing the three pipeline stages (Filter → Classify → Deliver)
- **npm publishing setup** — `.npmignore` excluding source maps, build artifacts, editor files, test fixtures, and doc internals; `CHANGELOG.md` added to package `files`
- **npm badges** — version and downloads badges in README
- **Codemap refresh** — all 7 `.planning/codebase/` documents updated to reflect current architecture (9 modules, 132 tests, DI patterns, auth paths)

### Changed

- **README refinement** — deduplicated install section, added 📦 Installation with pi + npm commands, linked CHANGELOG from footer
- **`sanitizeApiKey` control character filtering** — simplified from `.split("").filter(charCodeCheck).join("")` approach; regex alternatives blocked by oxlint `no-control-regex` even via `new RegExp()`

### Fixed

- **WorkOS token leak in `resolveApiKey`** — pi `auth.json` path now skips `workos:`-prefixed access values (short-lived OAuth tokens should not be returned as static API keys); mirrors existing guard in `resolveClineProvidersKey`

### Tests

- **132 unit tests across 8 files** (up from 124 across 9, consolidated test files)
- New test: WorkOS token skipping in pi `auth.json` path (`tests/unit/auth.test.ts`)

## [1.0.1] — 2026-06-30

### Added

- **Refresh timeout** — `AbortSignal.timeout(15s)` on WorkOS token refresh fetch, with user-friendly `AbortError` message
- **expiresAt validation** — `Number.isFinite` guard alongside `typeof === "number"` in `resolveClineAuthCredentials` to reject `NaN`/`Infinity`
- **`toMicroPerToken` helper** — eliminates redundant `numberValue()` calls in `parseRemoteModel` pricing parsing
- **`fetchRemoteModels` optimization** — combined `filter → map → filter` into single `reduce()` pass
- **Display name fallback** — remote model name prefers `fallback?.name` before raw `id`
- **`resolveApiBase` normalization** — trimming, empty-string fallback, trailing-slash removal
- **403 guidance expansion** — mentions org-level ClinePass admin contact
- **Defensive null guard** — `if (!event.message) return;` in `handleClinePassError`
- **CI hardening** — `persist-credentials: false` on all `actions/checkout` steps
- **Documentation** — ADR-0006 (module split + WorkOS adapter extraction), codebase map updates, npm badges + install instructions in README

### Changed

- **`src/env.ts`** — `sanitizeApiKey` simplified from `Array.from().filter().join()` to regex `.replace()`
- **Architecture** — codebase map documents updated to reflect module-split architecture (9 source modules, 9 test files)

### Fixed

- **TypeScript error** — `makeCallbacks` `onPrompt` return type fixed from `string` to `Promise<string>` in oauth tests

### Tests

- **124 unit tests across 9 files** (up from 96 across 8)
- **`tests/unit/utils.test.ts`** — 19 tests for `isRecord`, `stringValue`, `numberValue`, `booleanValue`
- **`tests/unit/oauth.test.ts`** — 9 new `login()` tests: WorkOS auto-login (valid/expired/margin), manual paste (dashboard URL, empty key, trimming, short-key warning, paste wrapper removal)
- **`tests/unit/env.test.ts`** — 7 new `resolveApiBase` normalization tests (trailing slash, trim, empty string)

## [1.0.0] — 2026-06-29

### Added

- Initial release — ClinePass provider for pi
- 10 curated open-weight models: GLM-5.2, Kimi K2.7 Code, Kimi K2.6, DeepSeek V4 Pro, DeepSeek V4 Flash, MiMo-V2.5, MiMo-V2.5-Pro, MiniMax M3, Qwen3.7 Max, Qwen3.7 Plus
- OpenAI-compatible Chat Completions streaming via pi's built-in `openai-completions` provider
- WorkOS OAuth token refresh — reuses Cline CLI `cline auth` login with automatic token refresh via `POST /api/v1/auth/refresh`
- Static API key authentication with auto-discovery from `CLINE_API_KEY` env var, `~/.cline/data/settings/providers.json`, or `~/.pi/agent/auth.json`
- Dynamic model discovery from Cline's `/models` endpoint, falling back to static list on error
- `/login` integration — automatic WorkOS OAuth detection or browser-assisted manual paste
- Error classification — user-friendly messages for 403 (subscription), 401 (auth), 429 (rate limit) errors
- Error surface via `message_end` event handler with filter → classify → deliver pipeline
- Injection-testable I/O via options objects (`AuthKeyOptions`, `RemoteModelsOptions`)
- 96 unit tests across 8 files
- E2E smoke tests (manual trigger with `CLINE_API_KEY`)
- CI matrix: Node 22 + Node 24, with minimum pi version pinning

[Unreleased]: https://github.com/jellydn/pi-clinepass-provider/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/jellydn/pi-clinepass-provider/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/jellydn/pi-clinepass-provider/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/jellydn/pi-clinepass-provider/releases/tag/v1.0.0
