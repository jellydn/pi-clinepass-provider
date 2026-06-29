# CONVENTIONS.md — Code Conventions

## Language

- **TypeScript** with `strict: true`
- **ESM** modules (`.js` extension in imports)
- Target **ES2022**, no downlevel compilation needed

## Module Organization

- Each source file has a single responsibility
- Every file starts with a `@module clinepass-<name>` JSDoc block
- Exported functions have JSDoc comments describing their purpose
- Internal helpers (not exported) have no JSDoc by convention unless complex
- All files under 250 lines; most are 50–150 lines

## Type Guards (`src/utils.ts`)

Four canonical type guards are used everywhere:

```typescript
isRecord(value: unknown): value is Record<string, unknown>
stringValue(value: unknown): string | undefined
numberValue(value: unknown): number | undefined
booleanValue(value: unknown): boolean | undefined
```

These are the only way to safely extract typed values from `unknown` in the codebase. No `any` casts or `as` assertions are used for data extraction.

### `numberValue` Specifics
- Only finite numbers pass (`Number.isFinite`)
- Strings are parsed via `Number(value)`; rejected if they have trailing non-numeric text (e.g., `"12px"` → `undefined`)
- `Infinity`, `-Infinity`, `NaN` → `undefined`
- Empty/whitespace-only strings → `undefined`

## Dependency Injection

Every function that performs I/O accepts an options object with injectable alternatives:

```typescript
export function resolveApiKey(
  providedKey?: string,
  options: AuthKeyOptions = {},
): string | undefined { ... }
```

Defaults use real implementations:
- `options.env ?? process.env`
- `options.readFile ?? ((p: string) => readFileSync(p, "utf-8"))`
- `options.fileExists ?? ((p: string) => existsSync(p))`
- `options.homeDir?.() ?? homedir()`
- `options.fetch ?? globalThis.fetch`

## Error Handling

### File Read Errors
- `ENOENT` errors (file not found) are silently skipped — expected during normal operation
- Other errors (corrupt JSON, permission denied) are logged via `console.warn()` with a `[clinepass]` prefix
- File contents and resolved keys are **never** logged

### Network Errors
- `fetchRemoteModels()` catches all errors and returns `undefined` — callers fall back to static data
- `refreshWorkosToken()` throws on timeout (`DOMException` with `name === "AbortError"`) and non-OK responses with descriptive messages

### User-Facing Errors
- ClinePass API errors (403, 401, 429) are classified via `classifyClinePassError()` and surfaced through pi's UI notification system
- Non-ClinePass errors are silently ignored (early return in `handleClinePassError`)

## Naming Conventions

| Category | Convention | Examples |
|----------|-----------|----------|
| Functions | camelCase | `resolveApiKey`, `fetchRemoteModels` |
| Types/Interfaces | PascalCase | `ModelConfig`, `AuthKeyOptions` |
| Constants | SCREAMING_CASE | `DEFAULT_API_BASE`, `PROVIDER_NAME` |
| Files | kebab-case | `error-handler.ts` |
| Test files | `<name>.test.ts` | `auth.test.ts` |
| Test describes | function name | `describe("resolveApiKey", ...)` |
| Module tags | `clinepass-<module>` | `@module clinepass-auth` |

## Imports

- Node built-ins first (`node:fs`, `node:os`, `node:path`)
- pi SDK types second (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`)
- Internal modules last (`./env.js`, `./utils.js`)
- Use `.js` extension for internal imports (ESM convention)
- No barrel files — direct imports only

## Comments

- Source comments use `//` with a space after the slashes
- Section dividers: `// ─── Section Name ─────────────────────────────────────`
- JSDoc for all exported functions and interfaces
- Inline comments explain **why**, not **what**

## Formatting

- **Formatter**: oxfmt (Biome-compatible)
- No manual formatting decisions — oxfmt handles everything
- CI checks formatting with `npm run format:check`

## Linting

- **Linter**: oxlint with TypeScript + unicorn + oxc + import + jest plugins
- `correctness` rules are errors
- `suspicious` rules are warnings
- `unicorn/consistent-function-scoping` disabled in test files (`.oxlintrc.json` override)
- Pre-commit hooks via `prek` enforce lint + format + basic file hygiene

## Version Control

- Main branch: `main`
- Feature branches: `feat/<name>`
- Commits use conventional commit format: `type(scope): message`
- Releases via `bumpp` (auto-bumps version, commits, tags, pushes)
- No pre-commit hook enforcement on commits (use `--no-verify` when needed)
