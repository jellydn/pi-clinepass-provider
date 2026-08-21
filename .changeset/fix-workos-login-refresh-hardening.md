---
"pi-clinepass-provider": patch
---

fix(oauth): harden WorkOS login when refresh token is stale

Pick the freshest WorkOS credentials across `cline-pass`, `cline`, and pi
`auth.json`; fall back to manual API-key paste when subscription refresh
fails. Treat credentials with missing/invalid expiry as stale (force refresh)
so they cannot outrank known-expired-but-refreshable ones.
