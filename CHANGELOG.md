# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- CHANGELOG.md for release tracking

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

[Unreleased]: https://github.com/jellydn/pi-clinepass-provider/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/jellydn/pi-clinepass-provider/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/jellydn/pi-clinepass-provider/releases/tag/v1.0.0
