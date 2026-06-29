# CONVENTIONS.md — Coding Conventions

## Language & Style

| Aspect        | Convention                                                    |
| ------------- | ------------------------------------------------------------- |
| Language      | TypeScript (strict mode)                                      |
| Module system | ESM (`import`/`export`, `.js` extensions in relative imports) |
| Strictness    | `strict: true`, `noEmit: true`, `skipLibCheck: true`          |
| Formatting    | `oxfmt` (Rust-based formatter)                                |
| Linting       | `oxlint` with typescript, unicorn, oxc, import, jest plugins  |
| Lib           | `["ES2022"]` — no DOM (Node-only extension)                   |
| Types         | `["node"]` — Node.js globals only                             |

## Import Style

- Relative imports use `.js` extensions: `import { ... } from "./env.js"`
- Type-only imports use `import type { ... }`: `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"`
- Imports grouped: external packages first, then internal modules

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { handleClinePassError } from "./error-handler.js";
import { resolveApiBase, PROVIDER_NAME, ENV_API_KEY } from "./env.js";
import { resolveApiKey } from "./auth.js";
import { resolveModels } from "./models.js";
import { getApiKey as oauthGetApiKey, login, refreshToken } from "./oauth.js";
```

## Type Patterns

- **No `any` type** — use `unknown` and narrow with type guards
- **Type guards** as standalone functions: `isRecord()`, `stringValue()`, `numberValue()`, `booleanValue()`
- **Interfaces** for object shapes, **type aliases** for unions
- **Readonly** where possible: `readonly ModelConfig[]`, `readonly ["text"]`

```typescript
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

## Dependency Injection

All I/O is parameterized via options objects for testability:

```typescript
export interface AuthKeyOptions {
  env?: Record<string, string | undefined>;
  authPaths?: readonly string[];
  homeDir?: () => string;
  readFile?: (path: string) => string;
  fileExists?: (path: string) => boolean;
}
```

- Functions accept optional `options` parameter with injectable I/O
- Default to real implementations (`process.env`, `readFileSync`, `existsSync`)
- Tests pass mock implementations — no FS or network access needed

## Error Handling

| Pattern                                   | Where                           | Example                                                      |
| ----------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| `console.warn` for non-fatal warnings     | `src/workos.ts`, `src/oauth.ts` | `[clinepass] Warning: failed to read auth file`              |
| `console.error` for UI-less error surface | `src/error-handler.ts`          | `[clinepass] ClinePass subscription required...`             |
| `throw new Error()` for fatal failures    | `src/workos.ts`                 | `throw new Error("ClinePass token refresh failed...")`       |
| `ctx.ui.notify()` for user-facing errors  | `src/error-handler.ts`          | `ctx.ui.notify(friendlyMessage, "error")`                    |
| Silent catch with fallback                | `src/models.ts`                 | `fetchRemoteModels` catches all errors → returns `undefined` |

### Error Classification Pattern

```typescript
export function classifyClinePassError(errorMessage: string): {
  type: ClinePassErrorType;
  message: string;
};
```

Errors are pattern-matched on lowercased message text for HTTP status codes and keywords. User-friendly messages are stored in a constant map (`CLINEPASS_ERROR_MESSAGES`). The full error pipeline (filter → classify → deliver) is owned by `src/error-handler.ts`.

### Dependency Injection Patterns

All I/O is parameterized via options objects. Three consistent DI patterns:

```typescript
// File I/O (auth.ts)
export interface AuthKeyOptions {
  env?: Record<string, string | undefined>;
  authPaths?: readonly string[];
  homeDir?: () => string;
  readFile?: (path: string) => string;
  fileExists?: (path: string) => boolean;
}

// Network I/O (models.ts)
export interface RemoteModelsOptions {
  fetch?: typeof globalThis.fetch;
  apiBase?: string;
  timeoutMs?: number;
}

// Network I/O (workos.ts)
export interface WorkosRefreshOptions {
  fetch?: typeof globalThis.fetch;
  apiBase?: string;
}
```

Functions default to real implementations (`process.env`, `readFileSync`, `globalThis.fetch`). Tests pass mocks — no I/O needed.

### Deep Module Pattern

Deep modules have an interface significantly simpler than their implementation:

```typescript
// Deep: interface is (event, ctx) => void, behind it: type assert → filter → classify → deliver
export function handleClinePassError(
  event: { message: unknown },
  ctx: { hasUI: boolean; ui: { notify: (...) => void }; model?: { provider?: string } },
): void;

// Deep: interface is (string) => {type, message}, behind it: 14 pattern matches
export function classifyClinePassError(errorMessage: string): { type: ClinePassErrorType; message: string };

// Deep: interface is (credentials, options?) => OAuthCredentials, behind it: HTTP POST + parse + prefix + expiry
export async function refreshWorkosToken(
  credentials: OAuthCredentials,
  options?: WorkosRefreshOptions,
): Promise<OAuthCredentials>;
```

## Section Organization

Files use `// ─── Section Name ───...` comment dividers. Each domain module has its own sections:

```typescript
// env.ts sections:
// ─── Constants ──────────────────────────────────────────────────────────────
// ─── resolveApiBase ─────────────────────────────────────────────────────────
// ─── sanitizeApiKey ──────────────────────────────────────────────────────────

// models.ts sections:
// ─── Static Model Definitions ───────────────────────────────────────────────
// ─── Dynamic Model Discovery ────────────────────────────────────────────────

// auth.ts sections:
// ─── API Key Resolution ──────────────────────────────────────────────────────

// workos.ts sections:
// ─── WorkOS Constants ──────────────────────────────────────────────────────
// ─── Types ─────────────────────────────────────────────────────────────────
// ─── Token Utilities ───────────────────────────────────────────────────────
// ─── Token Refresh ─────────────────────────────────────────────────────────
// ─── Credential Extraction ─────────────────────────────────────────────────

// errors.ts sections:
// ─── Types ─────────────────────────────────────────────────────────────────
// ─── Error Messages ────────────────────────────────────────────────────────
// ─── Classification ────────────────────────────────────────────────────────

// error-handler.ts sections:
// ─── Filter ────────────────────────────────────────────────────────────────
// ─── Classify + Deliver ────────────────────────────────────────────────────

// oauth.ts sections:
// ─── Static API key helpers ──────────────────────────────────────────────────
// ─── Login flow ─────────────────────────────────────────────────────────────

// index.ts sections:
// ─── Extension Entry Point ─────────────────────────────────────────────────
// ─── Error Surface ─────────────────────────────────────────────────────────
```

## JSDoc Conventions

- Module-level JSDoc at top of file with `@module` tag
- Function JSDoc with `@param`, `@returns` for exported functions
- Inline comments for "why" not "what"
- References to external docs: `per Cline PR #11355`, `https://docs.cline.bot/...`

## Naming Conventions

| Category    | Convention            | Example                                   |
| ----------- | --------------------- | ----------------------------------------- |
| Constants   | UPPER_SNAKE_CASE      | `DEFAULT_API_BASE`, `WORKOS_TOKEN_PREFIX` |
| Functions   | camelCase             | `resolveApiKey`, `fetchRemoteModels`      |
| Interfaces  | PascalCase            | `ModelConfig`, `AuthKeyOptions`           |
| Types       | PascalCase            | `ClinePassErrorType`                      |
| Type guards | `isXxx()` / `isXxx()` | `isRecord`, `isWorkosToken`               |
| Parsers     | `parseXxx()`          | `parseRemoteModel`                        |
| Resolvers   | `resolveXxx()`        | `resolveApiKey`, `resolveModels`          |
| Builders    | `buildXxx()`          | `buildEndpointUrl`                        |
| Sanitizers  | `sanitizeXxx()`       | `sanitizeApiKey`                          |

## Lint Overrides

Test files disable `unicorn/consistent-function-scoping` (test helpers are local):

```json
{
  "overrides": [
    {
      "files": ["tests/**/*.test.ts"],
      "rules": {
        "unicorn/consistent-function-scoping": "off"
      }
    }
  ]
}
```
