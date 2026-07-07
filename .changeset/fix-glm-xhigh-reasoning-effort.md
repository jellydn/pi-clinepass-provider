---
"pi-clinepass-provider": patch
---

fix: map GLM-5.2 xhigh thinking level to ClinePass reasoning.effort xhigh

GLM-5.2's xhigh thinking level was mapped to `"max"` (the Z.ai native API
tier name), but ClinePass exposes an OpenAI-compatible endpoint whose
`reasoning_effort` wire value for the extra-high tier is `"xhigh"`.
Sending `"max"` was rejected by the ClinePass API with HTTP 400.

Map `xhigh` → `"xhigh"` so pi's xhigh thinking level reaches GLM-5.2's
Max tier through ClinePass without error.
