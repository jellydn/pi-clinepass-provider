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
- **Follow-up:** set `off` to `null` and added an explicit K3 thinking-map unit test. The contributor manually confirmed a successful ClinePass completion with `cline-pass/kimi-k3` and pi `--thinking high` (`reasoning_effort: "max"`).

### 2026-07-19 — PR review reply API payload

- **Context:** replying to inline GitHub review comments on PR #43
- **Type:** learning
- **Detail:** GitHub's review-comment REST endpoint requires `in_reply_to` as a JSON number; `gh api -f` serializes it as a string and is rejected.
- **Follow-up:** use `gh api --input` with a JSON payload for inline replies.

### 2026-08-10 — qwen3.8-max cannot disable thinking via reasoning_effort

- **Context:** pre-PR review of the `cline-pass/qwen3.8-max` catalog entry
- **Type:** issue
- **Detail:** `off: "none"` is a no-op. Intercepting the wire (point `CLINE_API_BASE` at a local HTTP server) shows pi sends `reasoning_effort: "none"` for `--thinking off`, but qwen3.8-max's enum is only `low`/`medium`/`xhigh` (default `xhigh`) and thinking is disabled solely via `enable_thinking: false`. pi's default `openai` thinkingFormat never sends that field, so the value is ignored and the model keeps thinking while the UI reports "off". Setting `compat.thinkingFormat: "qwen"` does send `enable_thinking`, but that branch in `openai-completions.js` is an exclusive `else if` that then omits `reasoning_effort` entirely, losing all tier control.
- **Follow-up:** set `off: null` so the level is not offered, matching the Kimi K3 precedent. Confirmed by test: `getSupportedThinkingLevels` drops null levels, leaving `low`/`medium`/`xhigh`.

### 2026-08-10 — same reasoning_effort no-op likely affects qwen3.7 entries

- **Context:** follow-on from the qwen3.8-max finding above
- **Type:** issue
- **Detail:** `cline-pass/qwen3.7-max` and `cline-pass/qwen3.7-plus` both declare `off: "none"`. A manual check against the live API showed qwen3.7 still thinks with thinking set to off, i.e. the same out-of-enum `reasoning_effort` behaviour.
- **Follow-up:** left unchanged deliberately — out of scope for the Qwen3.8 Max PR. Worth a separate fix setting `off: null` on both entries after confirming against the provider docs.
