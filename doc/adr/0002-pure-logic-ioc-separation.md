# 2. Pure logic/IoC separation for testability

Date: 2026-06-30

## Status

Accepted

## Context

The provider needs to perform side-effectful operations: reading files (API keys from various auth stores), making HTTP requests (dynamic model discovery, token refresh), and accessing environment variables. Without careful design, these operations tangle business logic with I/O, making unit tests slow, flaky, or impossible without network/file-system access.

We considered three approaches:

1. **Inline I/O** — read files and fetch URLs directly in the extension entry point. Simple but untestable.
2. **Mock at the module level** — use `vi.mock()` to stub modules. Works but creates fragile tests coupled to module internals.
3. **Dependency injection / parameterized I/O** — export functions that accept I/O implementations as optional parameters, with reasonable defaults for production.

## Decision

Separate all pure logic into `src/logic.ts` with parameterized I/O for every side-effect, keeping `src/index.ts` and `src/oauth.ts` as thin orchestration layers.

Every function that touches the filesystem, network, or environment accepts injectable overrides as its last parameter:

- **`resolveApiKey(providedKey?, options?)`** — accepts `options.env`, `options.readFile`, `options.fileExists`, `options.homeDir` with defaults from `process.env`, `fs.readFileSync`, `fs.existsSync`, and `os.homedir()`.
- **`resolveClineAuthCredentials(options?)`** — same pattern for WorkOS credential parsing.
- **`fetchRemoteModels(options?)`** — accepts `options.fetch`, `options.apiKey`, `options.apiBase`, and `options.timeoutMs`.
- **`resolveModels(apiKey?, options?)`** — composes `fetchRemoteModels` with static fallback.

`src/oauth.ts` imports only pure functions from `src/logic.ts`. The extension entry (`src/index.ts`) is the only module that calls production defaults.

## Consequences

### 📋 Positive

- **No mocking, no stubbing** — unit tests in `tests/unit/` use real function calls with injected test doubles (e.g., `() => "fake-key"` for `readFile`, `{}` for `env`). Tests are fast and deterministic.
- **Clear boundaries** — `src/logic.ts` has no import-time side effects. It exports pure functions and stateless constants.
- **Refactor-safe** — changing I/O implementations (e.g., switching from `readFileSync` to async reads) only requires changing the defaults, not every caller or test.
- **Separation of concerns** — the entry point wires things together; the logic module reasons about data; the OAuth module manages the user-facing login flow.

### 📋 Negative

- **Slightly more verbose signatures** — every I/O function has an optional options bag. The `AuthKeyOptions` interface has 5 optional fields.
- **Cognitive overhead** — developers must understand the injection pattern to add new side effects.
