# Implementation notes

Append-only log for AI agents and contributors. Record blockers, issues, findings, and learnings discovered during implementation.

**Rule:** all AI tools working in this repo must append here — see `AGENTS.md` → _Implementation notes (all AI tools)_.

## Entry template

```markdown
### YYYY-MM-DD — short title

- **Context:** what you were doing
- **Type:** blocker | issue | finding | learning
- **Detail:** what happened and why it matters
- **Follow-up:** optional next step, PR, or issue link
```

## Entries

_(append below — newest at bottom)_

### 2026-07-07 — implement-notes rule added

- **Context:** drafting AGENTS.md rule for cross-tool implementation logging
- **Type:** learning
- **Detail:** repo already had `.planning/codebase/` for static codebase maps; `.planning/implement-notes.md` is the session-scoped append log distinct from CONCERNS.md (tracked gaps) and ADRs (decisions)
- **Follow-up:** agents append here during work; link PRs/issues in follow-up lines when resolved

### 2026-07-15 — consolidate implement-notes under .planning

- **Context:** PR #25 review (Gemini Code Assist)
- **Type:** learning
- **Detail:** moved log from `.plans/` to `.planning/implement-notes.md` to avoid root dirs `.plans` vs `.planning`
- **Follow-up:** addressed in commit for PR #25

### 2026-07-19 — add Kimi K3 static catalog entry

- **Context:** adding `cline-pass/kimi-k3` to static model catalog in `src/models.ts`
- **Type:** learning
- **Detail:** local env lacked project deps initially (`vitest` missing); running `npm install` was required before tests could execute.
- **Follow-up:** run `npm test` after `npm install` in fresh environments.

### 2026-07-19 — Kimi K3 reasoning-level review finding

- **Context:** reviewing the Kimi K3 catalog entry before a public PR
- **Type:** issue
- **Detail:** Kimi documents K3 as always-on reasoning with only `reasoning_effort: "max"`; mapping pi `off` to `"none"` can send an unsupported provider value.
- **Follow-up:** set `off` to `null` and added an explicit K3 thinking-map unit test. Attempted live validation, but `CLINE_API_KEY` is not set in this environment; `cline-pass/kimi-k3` plus `"max"` still requires a live ClinePass validation before merge.
