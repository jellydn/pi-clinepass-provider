---
"pi-clinepass-provider": minor
---

feat: add Qwen3.8 Max to the ClinePass static model catalog

Adds `cline-pass/qwen3.8-max` with its 1M context window, output limit, and
reference pricing from Alibaba Cloud Model Studio (Singapore). Reasoning maps
to qwen3.8-max's native `low`/`medium`/`xhigh` tiers; `minimal` and `high` are
left unsupported (null) so no two offered thinking levels resolve to the same
effort. `off` is also unsupported — the model only disables thinking via
`enable_thinking: false`, which pi's openai-completions format does not send.
