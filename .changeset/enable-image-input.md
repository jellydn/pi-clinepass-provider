---
"pi-clinepass-provider": minor
---

feat: enable image input for multimodal ClinePass models

Nine of the twelve catalog models are multimodal upstream and are now
declared with `input: ["text", "image"]`: GLM-5.3-Flash, Kimi K3, Muse
Spark 1.3 Contributor, DeepSeek V4.1 Flash, MiMo-V2.5, MiMo-V2.5-Pro,
MiniMax M3, Qwen3.7 Plus, and Qwen3.8 Max. GLM-5.3, DeepSeek V4 Pro, and
Qwen3.7 Max remain text-only. Previously every model was hard-declared
text-only, so pi-ai silently stripped pasted images before the request
reached Cline.

Images are sent as base64 `image_url` content via pi's built-in
`openai-completions` streaming. Dynamic model discovery now derives input
modality from the remote entry's `architecture.input_modalities` metadata
(an array of strings containing `"image"` marks the model image-capable),
falling back to the static catalog's declaration when the metadata is
missing or invalid.
