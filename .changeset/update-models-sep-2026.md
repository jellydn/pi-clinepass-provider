---
"pi-clinepass-provider": minor
---

feat: refresh ClinePass model catalog for Sep 2026 additions and deprecations

Adds `cline-pass/muse-spark-1.3-contributor` (1M context, contributor-tier
pricing $0.10/$0.20, always-on reasoning with pi levels mapping 1:1 to Meta's
minimal→xhigh enum) and `cline-pass/deepseek-v4.1-flash` (replaces DeepSeek
V4 Flash), plus `cline-pass/glm-5.3-flash` (Z.ai's natively multimodal GLM-5
model, low/high/max always-on reasoning, 1M context).

Removes models deprecated by Cline effective 2026-09-21: `cline-pass/glm-5.2`,
`cline-pass/kimi-k2.7-code` and `cline-pass/kimi-k2.6` (→ Kimi K3), and
`cline-pass/deepseek-v4-flash` (→ DeepSeek V4.1 Flash).

Exact model IDs were verified against Cline's
`/api/v1/ai/cline/recommended-models` endpoint (`clinePass` array). DeepSeek
V4.1 Flash carries the deprecated V4 Flash reference pricing until ClinePass
publishes V4.1 rates; remote model discovery will override once pricing is
exposed by the API.
