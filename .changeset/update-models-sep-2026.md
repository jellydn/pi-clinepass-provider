---
"pi-clinepass-provider": minor
---

feat: refresh ClinePass model catalog for Sep 2026 additions and deprecations

Adds `cline-pass/muse-spark-1.3-contributor` (1M context, contributor-tier
pricing $0.10/$0.20 and $0.002 cached input, always-on reasoning with pi levels mapping 1:1 to Meta's
minimal→xhigh enum) and `cline-pass/deepseek-v4.1-flash` (replaces DeepSeek
V4 Flash), plus `cline-pass/glm-5.3-flash` (Z.ai's natively multimodal GLM-5
model, low/high/max always-on reasoning, 1M context).

Removes models immediately in preparation for Cline's announced 2026-09-21 cutoff:
`cline-pass/glm-5.2` (→ GLM-5.3),
`cline-pass/kimi-k2.7-code` and `cline-pass/kimi-k2.6` (→ Kimi K3), and
`cline-pass/deepseek-v4-flash` (→ DeepSeek V4.1 Flash).

Update saved model selections and scripts; no aliases are provided. Retired IDs
are excluded from dynamic discovery too. Runtime TypeScript contracts are unchanged,
but saved selections using removed IDs are not backward-compatible.

Muse Spark is hosted, not open-weight. Meta's Contributor tier permits training
on prompts and completions; check Cline's applicable terms before sending private code.
This extension exposes all models as text-only.

Exact model IDs were verified against Cline's
`/api/v1/ai/cline/recommended-models` endpoint (`clinePass` array). DeepSeek
V4.1 Flash uses upstream peak reference rates ($0.30/$1.20/$0.006 per million
input/output/cached-input tokens); upstream off-peak rates are half. The three new
models use upstream estimates, not confirmed ClinePass rates. Discovery overrides
prices only if `/api/v1/models` returns the exact `cline-pass/` ID with pricing
metadata; its public response currently contains upstream IDs without that metadata.
