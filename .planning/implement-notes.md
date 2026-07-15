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
