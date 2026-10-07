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

### 2026-08-21 — synchronized pi dependency upgrades conflict in the lockfile

- **Context:** merging Renovate PRs #49 and #50
- **Type:** learning
- **Detail:** the independent pi-ai and pi-coding-agent upgrades both rewrite the same package manifest and lockfile sections, so the second PR conflicts after the first lands.
- **Follow-up:** combined both `^0.84.0` constraints on #50, regenerated the lockfile from current `main`, and reran the full quality matrix.

### 2026-08-21 — oxfmt 0.64 expands repository-wide formatting changes

- **Context:** reviewing Renovate PR #51 with the full `prek` file scope
- **Type:** issue
- **Detail:** `npm run format:check` passed because it covers only `src/` and `tests/`, while oxfmt 0.64 rejected four tracked JSON/Markdown files included by `prek.toml`.
- **Follow-up:** formatted the affected tracked files with oxfmt 0.64 and verified the full `prek` file scope.

### 2026-08-21 — config-store extraction conflict after WorkOS hardening

- **Context:** updating PR #14 to current `main`
- **Type:** learning
- **Detail:** current WorkOS credential collection no longer uses `walkClineProviderSettings`, but it still shares `walkAuthPaths` and `AuthKeyOptions`; the old extraction branch conflicted only at that import boundary.
- **Follow-up:** import the remaining shared APIs directly from `config-store.ts` and preserve the current WorkOS candidate-selection behavior.

### 2026-08-21 — Qwen3.8 Max PR review gaps

- **Context:** reviewing PR #55 before merge
- **Type:** issue
- **Detail:** the landing page implied an unsupported `high` reasoning level, architecture docs retained a stale line count, and the model-specific test did not pin catalog metadata.
- **Follow-up:** listed the supported levels explicitly, removed the volatile line count, and added exact pricing and token-limit assertions.

### 2026-09-18 — Sep 2026 catalog refresh verified against recommended-models endpoint

- **Context:** implementing issue #79 (add MuseSpark 1.3 Contributor + DeepSeek v4.1-flash, remove deprecated models) before the 2026-09-21 cutoff
- **Type:** finding
- **Detail:** `/api/v1/models` returns no `cline-pass/` entries (445 upstream models only), but `/api/v1/ai/cline/recommended-models` exposes a `clinePass` array with exact slugs — including `cline-pass/muse-spark-1.3-contributor`, `cline-pass/deepseek-v4.1-flash`, and `cline-pass/glm-5.3-flash`. The deprecated IDs were still listed pre-cutoff. Cline's docs page had not yet been updated.
- **Follow-up:** slugs verified before merging, per the issue's acceptance criteria. GLM-5.3-Flash was out of the issue's scope but added on request; worth confirming it stays in the catalog after the cutoff.

### 2026-09-18 — Muse Spark contributor tier excludes upstream max effort

- **Context:** deriving the `thinkingLevelMap` for `cline-pass/muse-spark-1.3-contributor` from Meta Model API docs
- **Type:** learning
- **Detail:** Muse Spark always reasons (`reasoning_effort: "none"` → HTTP 400, so `off: null`), and Meta's enum is minimal/low/medium/high/xhigh — but `"max"` is standard-tier `muse-spark-1.3` only and explicitly unavailable on Contributor models. pi's `xhigh` therefore maps to `"xhigh"`, not `"max"`, unlike GLM-5.3/Kimi K3.
- **Follow-up:** pinned by the unit test "Muse Spark 1.3 Contributor maps pi levels 1:1".

### 2026-09-18 — DeepSeek V4.1 Flash reference pricing not yet published

- **Context:** populating cost metadata for the new DeepSeek entry
- **Type:** issue
- **Detail:** Cline's docs still show the old catalog with V4 Flash pricing only. Third-party trackers diverge ($0.22/$0.66 Fireworks, $0.30/$1.20 Requesty, $0.15/$0.60 off-peak direct), so no authoritative ClinePass rate exists yet.
- **Follow-up:** entry carries the deprecated V4 Flash rates as a placeholder with a code comment; remote model discovery overrides cost automatically once the API exposes V4.1 pricing. Revisit after 2026-09-21.

### 2026-09-18 — PR #80 review: catalog and documentation gaps

- **Context:** reviewing issue #79 and PR #80 against live Cline and upstream documentation
- **Type:** issue
- **Detail:** Cline's recommended-models endpoint confirms all 12 proposed IDs; `/api/v1/models` still exposes upstream IDs without ClinePass metadata. Meta's pricing page lists Contributor cached input at $0.002/M, not zero, and its model docs distinguish hosted Muse Spark from open-weight Muse Glimmer. README/site omit the Contributor training-data caveat and DeepSeek placeholder-price warning. README retains an obsolete catalog image and incorrectly groups GLM-5.2 with Kimi replacements. Remote discovery can reintroduce retired IDs; DeepSeek metadata and the new models' discovery maps need regression coverage.
- **Follow-up:** fix the confirmed gaps without adding aliases or changing the discovery endpoint. Keep input text-only until ClinePass multimodal support is verified. Live completion checks need `CLINE_API_KEY`, which is not configured in this orb. Sources: https://dev.meta.ai/docs/models and https://dev.meta.ai/docs/pricing-rate-limits.

### 2026-09-18 — fresh ClinePass pricing check during PR #80 review

- **Context:** user requested a fresh read of https://docs.cline.bot/getting-started/clinepass
- **Type:** finding
- **Detail:** the page still lists the old catalog and omits all three additions, but now lists DeepSeek peak/off-peak rates. The inherited V4 Flash $0.14/$0.28/$0.0028 rates are stale. DeepSeek's official pricing page identifies Flash as V4.1 and lists peak $0.30/$1.20/$0.006, with off-peak at half those rates. The ClinePass page promises 2–5x usage, not rate limits. OpenRouter's public model API confirms Muse Contributor's 943,718 output limit; this was not found in Meta's own model page.
- **Follow-up:** replace the inherited DeepSeek Flash estimate with upstream peak pricing and explicit ClinePass/peak caveats. Leave the pre-existing V4 Pro pricing drift outside this catalog refresh and flag it for follow-up. Preserve the minor changeset for the upstream catalog refresh, with an explicit saved-selection migration warning. No release or merge performed.

### 2026-09-20 — PR #80 release verification endpoint

- **Context:** addressing CodeRabbit's published review before merging PR #80
- **Type:** issue
- **Detail:** the release checklist still directed model-ID checks to `/models`, despite the earlier finding that the model list exposes upstream IDs. The PR description also retained the superseded DeepSeek V4 Flash pricing explanation.
- **Follow-up:** use the recommended-models endpoint's `clinePass` slugs in the checklist and update the PR description to state the current upstream peak estimates and exact-ID discovery requirement.

### 2026-09-20 — full catalog verification permits only explained differences

- **Context:** CodeRabbit's follow-up requested full-set verification instead of a spot-check
- **Type:** finding
- **Detail:** all 12 static IDs occur in the live recommended-models response. Its four additional IDs are exactly the intentionally retired models. Strict set equality would therefore reject the intended pre-cutoff catalog; remote discovery also deliberately supports future IDs outside the static catalog.
- **Follow-up:** require checking every static ID and documenting every remote-only ID. Missing static IDs and unexplained differences fail release verification.

### 2026-09-20 — pi 0.86.0 range bump is not a custom-stream migration

- **Context:** splitting `bun outdated` / npm latest into in-range patches vs an intentional pi `^0.86.0` bump
- **Type:** finding
- **Detail:** caret on `0.84.x` / `0.85.x` cannot resolve `0.86.0`. The 0.86.0 breaking change (stream inputs `Context` → `TranscriptContext`, `getCurrentSystemPrompt()` / `getCurrentTools()`) applies to custom `streamSimple` providers. This extension still uses `api: "openai-completions"`, which remains a `KnownApi`. `pi.on("message_end", …)` still exists; `on()` now returns an unsubscribe function (additive). `refreshToken` is typed as `(credentials, signal: AbortSignal)` — our implementation omits `signal` and still type-checks because extra parameters are ignorable; WorkOS refresh already uses a 15s `AbortSignal.timeout`. E2E CLI flags `--no-extensions`, `-e`, `--model`, `--no-tools`, `-p` are unchanged in pi 0.86.0. Local `npm install --no-save` of `0.80.2` still passes `typecheck` + unit tests. oxfmt `0.68.0` did not reformat `src/` or `tests/`.
- **Follow-up:** optionally thread pi's abort signal into `refreshWorkosToken` so cancelled refreshes stop before the 15s timeout. Do not add a `bun.lock` alongside `package-lock.json`.

### 2026-09-30 — enable image input for multimodal ClinePass models

- **Context:** implementing image-input support in `src/models.ts` after users reported pasted images being dropped
- **Type:** finding
- **Detail:** all 12 static models were hard-declared `input: ["text"]`, so pi-ai's `downgradeUnsupportedImages` (transform-messages.js) silently stripped any attached image and substituted "(image omitted: model does not support images)" before the request ever reached Cline. Research (OpenRouter `architecture.input_modalities`, corroborated by vendor docs) shows the ClinePass catalog is mixed-modality: 9 models are image-capable (kimi-k3, glm-5.3-flash, mimo-v2.5, mimo-v2.5-pro, minimax-m3, muse-spark-1.3-contributor, qwen3.8-max, qwen3.7-plus, deepseek-v4.1-flash) and 3 are text-only (glm-5.3, deepseek-v4-pro, qwen3.7-max). MiMo-V2.5-Pro's OpenRouter metadata is disputed/wrong — Xiaomi's official docs mark it native omni-modal (models.dev issue #1993), so the vendor is trusted. Cline's own client derives cline-pass capabilities from OpenRouter metadata via `modalities.input.includes("image")`, and Cline's API docs state image-capable models accept base64 image content in `messages`, so the gateway accepts `image_url` content for these models.
- **Follow-up:** this change adds `ModelInput` ("text" | "image" modality list), flips the 9 multimodal static entries to `["text", "image"]`, and derives `input` in `parseRemoteModel` from the remote entry's `architecture.input_modalities` (array-of-strings containing "image" → text+image; otherwise static fallback's input; otherwise text-only). A pending changeset marks it as a minor bump. Worth a live multimodal smoke test with `CLINE_API_KEY` once available.
- **Correction (2026-10-07):** the MiMo-V2.5-Pro claim above is incorrect. models.dev PR #1993 was closed unmerged after its author confirmed Pro is text-only; the multimodal sources describe vanilla V2.5. Restore Pro to text-only: eight static models accept images and four accept text only. Upstream metadata does not establish live ClinePass image support.

### 2026-09-30 — upstream push access requires a fork

- **Context:** publishing the multimodal image-input work from a local clone whose `origin` points at `jellydn/pi-clinepass-provider`
- **Type:** learning
- **Detail:** the GitHub CLI here is authenticated as `Leos0508`, which has only `pull` permission on the upstream repo (API `permissions: {admin:false, maintain:false, push:false, triage:false}`), so `git push origin <branch>` fails regardless of branch. Contributions must go through a fork: `gh repo fork jellydn/pi-clinepass-provider --remote=false`, then push to a separately named remote (this session used `fork`) and open the PR with explicit `--repo`/`--head` flags. Keeping `origin` pointed upstream means `git fetch` still tracks the real default branch. The upstream remote also has ~14 stale `renovate/*` and `coderabbitai/*` branches; `git branch -a` is noisy.
- **Follow-up:** PR #84 (`feat/multimodal-image-input`) opened as a draft from `Leos0508/pi-clinepass-provider`. CONTRIBUTING.md asks for draft PRs and explicit staging rather than `git add -A`.

### 2026-10-07 — PR #84 needs a real image smoke test

- **Context:** fixing the multimodal PR review before a conditional merge
- **Type:** blocker
- **Detail:** the existing E2E script sends text only. Add a known shape-count PNG and attach it through pi to all eight image-capable IDs; require a successful exit, the correct visual counts, and no image-omission placeholder. The contributor reports local image tests but their reply still contains evidence placeholders. This orb has no `CLINE_API_KEY`; repository Actions secrets cannot be inspected with the current integration (HTTP 403).
- **Follow-up:** run the expanded E2E suite with an authorized key and record the pi version, exact model IDs, and sanitized results before declaring the live gateway path verified. Do not merge solely on unit-test or mocked results.

### 2026-10-07 — align pi devDependencies to 1.0.4

- **Context:** `npm outdated` (deps installed) reported `@earendil-works/pi-ai` current `0.86.0`, wanted `0.86.1`, latest `1.0.4`. `bun outdated` is not the merge source; CI uses `npm ci` and `package-lock.json`. Without `node_modules`, `npm outdated` returns `{}`.
- **Type:** finding
- **Detail:** `^0.86.0` allows only `0.86.1` (caret on `0.x` stops before `0.87.0`). `0.87.x` and `0.99.x` exist before `1.0.4`. Published `OAuthCredentials` is unchanged from `0.80.2` through `1.0.4`: `{ refresh, access, expires, [key: string]: unknown }`. `OAuthLoginCallbacks` matches between `0.86.0` and `1.0.4`. `pi.registerProvider(name, { api: "openai-completions", oauth, models })` is still a valid overload. Since `pi-coding-agent@0.86.0`, `oauth.refreshToken` is typed `(credentials, signal: AbortSignal) => Promise<OAuthCredentials>`. Our `refreshToken(credentials)` stays assignable. `refreshWorkosToken` still aborts only via its own `AbortSignal.timeout` and does not observe pi's signal. That gap already existed on the `^0.86.0` range; `1.0.4` did not add it. Bumping both devDependencies to `^1.0.4` hoists one `pi-ai@1.0.4` and drops the nested copy. `npm run typecheck && npm test` passed on `1.0.4` and, after `npm install --no-save` of both packages at `0.80.2`, on the CI minimum (178 tests each). Peer ranges stay `*`.
- **Follow-up:** thread pi's `AbortSignal` into the WorkOS refresh fetch if cancellation during refresh becomes a real failure. `npm outdated` is empty after the bump.
