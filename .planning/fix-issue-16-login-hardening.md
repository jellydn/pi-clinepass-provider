# Fix #16 — Login refresh hardening

## Problem

`pi /login` → ClinePass fails with `token refresh failed (400)` when the refresh
token in `providers.json` is stale/revoked, or when fresher credentials exist
elsewhere (pi `auth.json`, `cline` vs `cline-pass`).

## Changes

1. **`resolveClineAuthCredentials`** — scan all auth files, collect every WorkOS
   candidate (pi `auth.json` `clinepass` OAuth + both CLI providers), return the
   one with the highest `expiresAt`.
2. **`login()`** — on refresh failure during auto-login, warn and fall back to
   manual API-key paste instead of hard-failing.

## Tests

- Freshest creds win across `cline-pass` / `cline`
- pi `auth.json` `clinepass` OAuth is discovered and preferred when fresher
- `login()` falls back to manual paste when refresh throws
