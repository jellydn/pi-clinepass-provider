---
"pi-clinepass-provider": minor
---

feat: add GLM-5.3 to the ClinePass static model catalog

Adds `cline-pass/glm-5.3` (Z.ai) with 1M context / 128K output. GLM-5.3 always
reasons and cannot be disabled; its `reasoning_effort` enum is `low`/`high`/`max`
(default `max`) with no `medium` or `xhigh` tier. pi's `off`/`minimal`/`medium`
map to `null` and `xhigh` maps to `max` so every offered level is distinct and
increasing. Pricing mirrors GLM-5.2 per the ClinePass docs.
