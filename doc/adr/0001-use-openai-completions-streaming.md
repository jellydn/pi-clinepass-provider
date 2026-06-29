# 1. Use pi's built-in openai-completions streaming

Date: 2026-06-30

## Status

Accepted

## Context

ClinePass exposes an OpenAI-compatible Chat Completions API (`/api/v1/chat/completions`) that returns standard SSE streams with delta-encoded content, tool calls, and usage metadata. pi supports two streaming models for model providers:

1. **`openai-completions`** — pi's built-in handler for standard OpenAI Chat Completions SSE format. pi handles event parsing, delta merging, tool call assembly, usage extraction, and error propagation automatically.

2. **Custom `streamSimple`** — a provider-defined streaming function for non-standard protocols (e.g., Command Code's NDJSON `/alpha/generate` endpoint). The provider must implement the full streaming logic.

We needed to choose which approach to use for the ClinePass provider.

## Decision

Use pi's built-in `openai-completions` API type with no custom `streamSimple` implementation.

Cline's infrastructure normalizes all upstream models (GLM, Kimi, DeepSeek, Qwen, MiniMax, etc.) to the standard OpenAI Chat Completions format before they reach the client. This means pi's built-in handler works correctly with all models.

The provider registration in `src/index.ts` specifies `api: "openai-completions"` and trusts pi to handle SSE parsing, tool calls, and usage tracking. No per-model compatibility overrides are configured initially — reasoning format handling is left to pi's defaults. If a specific model is found to have non-standard reasoning output through live testing, a model-level `compat` override (e.g., `compat: { thinkingFormat: "zai" }` for GLM) can be added later.

## Consequences

### 📋 Positive

- **Zero streaming code** — the provider is ~80 lines of glue code. No SSE parser, no delta merger, no tool call assembler.
- **Automatic pi upgrades** — when pi improves its `openai-completions` handler (e.g., better token counting or error recovery), ClinePass benefits for free.
- **Maintainability** — fewer lines of provider-specific code means fewer bugs and less test surface.
- **Consistent behavior** — all pi `openai-completions` providers behave identically, which simplifies debugging and user support.

### 📋 Negative

- **Less flexibility** — if Cline's API ever deviates from the OpenAI format, we're blocked until pi updates its handler or we implement a custom `streamSimple`.
- **Hidden abstraction** — reasoning format divergence (e.g., GLM's thinking vs DeepSeek's thinking) may require model-specific `compat` overrides that aren't obvious until someone tests with real reasoning output.
