# STACK.md — Technology Stack

## Languages & Runtime

| Aspect            | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Language          | TypeScript (strict mode)                                           |
| Runtime           | Node.js ≥ 22                                                       |
| Module system     | ESM (`"type": "module"`)                                           |
| Target            | ES2022                                                             |
| Module resolution | Bundler                                                            |
| No build step     | `tsconfig.json` has `noEmit: true`; pi loads `.ts` source directly |

## Core Dependencies

### Peer Dependencies (also in devDependencies for local dev)

| Package                           | Version Constraint                     | Role                                                  |
| --------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| `@earendil-works/pi-ai`           | `>=0.80 <0.90` (peer), `^0.80.2` (dev) | AI provider SDK — streaming, model types, OAuth types |
| `@earendil-works/pi-coding-agent` | `>=0.80 <0.90` (peer), `^0.80.2` (dev) | Coding agent CLI — extension API, event system        |

### devDependencies

| Package       | Version   | Role                                                   |
| ------------- | --------- | ------------------------------------------------------ |
| `typescript`  | `^6.0.3`  | Type checking (`tsc --noEmit`)                         |
| `vitest`      | `^4.1.5`  | Test runner                                            |
| `oxlint`      | `^1.71.0` | Linter (Rust-based, fast)                              |
| `oxfmt`       | `^0.56.0` | Formatter (Rust-based, fast)                           |
| `@types/node` | `^22.0.0` | Node.js type definitions (aligned with `engines.node`) |
| `bumpp`       | `^11.1.0` | Version bumping for releases                           |
| `np`          | `^11.2.1` | npm publish safety checks                              |

## Configuration Files

| File                       | Purpose                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `package.json`             | Project metadata, scripts, deps, `pi.extensions` entry point                                                             |
| `tsconfig.json`            | TypeScript config — strict, ESM, `lib: ["ES2022"]` (no DOM), `types: ["node"]`                                           |
| `.oxlintrc.json`           | Lint config — plugins: typescript, unicorn, oxc, import, jest; test override for `unicorn/consistent-function-scoping`   |
| `vitest.config.ts`         | Test config — includes `tests/**/*.test.ts`                                                                              |
| `.github/workflows/ci.yml` | CI — 3-variant matrix test job (latest/Node 22, min-pi-0.80.2/Node 22, latest/Node 24), E2E smoke tests (manual trigger) |

## npm Scripts

| Script                                              | Command                                      |
| --------------------------------------------------- | -------------------------------------------- |
| `test`                                              | `vitest run`                                 |
| `test:watch`                                        | `vitest`                                     |
| `test:e2e`                                          | `bash tests/e2e/smoke.sh`                    |
| `lint`                                              | `oxlint --config .oxlintrc.json src/ tests/` |
| `format`                                            | `oxfmt --write src/ tests/`                  |
| `format:check`                                      | `oxfmt --check src/ tests/`                  |
| `typecheck`                                         | `tsc`                                        |
| `release`                                           | `bumpp --commit --push --tag`                |
| `release:patch` / `release:minor` / `release:major` | Version-specific bumps                       |
| `pub`                                               | `npm publish`                                |

## Package Manager

- **npm** with `package-lock.json` (CI uses `npm ci`)
- No `bun.lock` or `yarn.lock` (removed in favor of single package manager)

## pi Extension Configuration

```json
{
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

The extension entry point is `src/index.ts`, loaded directly by pi (no compilation needed).

## Engines

```json
{
  "engines": {
    "node": ">=22"
  }
}
```

## Published Files

```json
{
  "files": ["src", "tests", "README.md", "LICENSE"]
}
```
