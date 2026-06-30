# Release Checklist

Follow these steps when cutting a new release of pi-clinepass-provider.

## 1. Pre-Release Verification

Before bumping the version, verify everything is clean:

```bash
# Must be clean
git status

# All tests pass
npm test

# TypeScript strict mode
npm run typecheck

# Lint: 0 errors, 0 warnings
npm run lint

# Format: consistent
npm run format:check

# Pre-commit hooks (via `prek` — global tool, install with `mise install prek`)
prek run --all-files
```

## 2. E2E Smoke Tests

Run manual end-to-end tests against a live Cline API. CI can't run these because
`CLINE_API_KEY` cannot be stored in public repo secrets.

```bash
# Requires a valid ClinePass API key
export CLINE_API_KEY=your_api_key_here

# Run the smoke test script
npm run test:e2e
```

### Manual Verification Checklist

If the automated smoke test passes, additionally verify:

- [ ] **Model discovery** — `pi --list-models clinepass` shows the expected models (dynamic discovery may add/remove models)
- [ ] **Chat completions** — `pi --model clinepass/cline-pass/deepseek-v4-flash -p "Hello"` returns a coherent response
- [ ] **Login flow (WorkOS OAuth)** — if you have `cline auth` credentials, `pi /login` → ClinePass detects them automatically
- [ ] **Login flow (static API key)** — `pi /login` → ClinePass → paste key works without errors
- [ ] **Error handling** — using an invalid API key produces a clear error message (not a stack trace)
- [ ] **Model IDs match** — the model IDs in `src/models.ts` `MODELS` array match the live API `/models` endpoint (spot-check 2-3 models)

## 3. Update Changelog

Move entries from `[Unreleased]` to a new version section:

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added / Changed / Fixed / Tests
```

Follow the existing format in `CHANGELOG.md`. Update the comparison links at the bottom.

## 4. Bump Version & Tag

```bash
# Interactive (choose patch/minor/major)
npm run release

# Or explicit
npm run release:patch    # 1.0.3 → 1.0.4
npm run release:minor    # 1.0.3 → 1.1.0
npm run release:major    # 1.0.3 → 2.0.0
```

This runs `bumpp` which:

- Bumps version in `package.json`
- Commits the change
- Creates a git tag (`vX.Y.Z`)
- Pushes the commit and tag

## 5. Create GitHub Release

After the tag is pushed:

1. Go to [GitHub Releases](https://github.com/jellydn/pi-clinepass-provider/releases)
2. Click **Draft a new release**
3. Choose the new tag (`vX.Y.Z`)
4. Title: `vX.Y.Z`
5. Copy the relevant changelog section as the release notes
6. Click **Publish release**

## 6. Publish to npm

```bash
npm run pub
```

Verify the package is published:

```bash
npm view pi-clinepass-provider version
```

## 7. Post-Release Verification

- [ ] `pi install npm:pi-clinepass-provider` installs the new version
- [ ] `pi --list-models clinepass` shows the expected models
- [ ] Quick chat test: `pi --model clinepass/cline-pass/deepseek-v4-flash -p "Hello"` works
- [ ] GitHub release page shows the correct changelog

## Emergency Rollback

If a release needs to be rolled back:

```bash
# Deprecate the package on npm (preferred for established releases)
npm deprecate pi-clinepass-provider@X.Y.Z "deprecated due to rollback, use vX.Y.Z+1"

# Delete the GitHub release and tag
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
```

> **Note:** `npm unpublish` is only possible within 72 hours of publishing and requires the `--force` flag. For established releases, deprecation is the standard approach.
