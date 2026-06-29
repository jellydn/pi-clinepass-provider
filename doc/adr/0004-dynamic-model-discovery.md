# 4. Dynamic model discovery with static fallback

Date: 2026-06-30

## Status

Accepted

## Context

ClinePass offers a curated set of open-weight coding models that changes over time — new models are added, deprecated, or have pricing adjusted. The Cline API exposes an OpenAI-compatible `/api/v1/models` endpoint for listing available models.

We needed a strategy for determining which models to register with pi at startup. Two approaches were considered:

1. **Static model list only** — maintain a hardcoded `MODELS` array in `src/logic.ts`. Simple but requires a code change and release whenever ClinePass updates their model catalog.
2. **Dynamic discovery only** — fetch from the API at startup. Always up-to-date but breaks entirely if the API is unreachable, returns a non-standard format, or doesn't expose a `/models` endpoint.

## Decision

Use dynamic model discovery from the Cline API as the primary source, with a hardcoded static `MODELS` array as a fallback on any error.

The `resolveModels()` function in `src/logic.ts`:

1. If an API key is available, calls `fetchRemoteModels()` with a 5-second timeout.
2. On success (valid response with at least one `cline-pass/` model), returns the remote models.
3. On any failure — network error, non-OK response, parse error, empty list, or timeout — logs nothing and falls back to the static `MODELS` array.

The static `MODELS` array is maintained as a curated list with reference pricing from the ClinePass docs (docs.cline.bot/getting-started/clinepass). The `fetchRemoteModels()` function parses the OpenAI-compatible format (`{ data: [{ id, name, context_length, max_output_tokens, pricing }] }` or a bare array) and falls back to static-model fields for any missing values.

Only models with IDs starting with `cline-pass/` are included from the API response, preventing non-ClinePass models from being registered.

## Consequences

### 📋 Positive

- **Future-proof** — when ClinePass adds a new model, users see it automatically after a restart. No extension update needed.
- **Resilient** — the extension works offline or when the API is down, using the static list. Users are never blocked from starting.
- **Up-to-date pricing** — the API's pricing data (in OpenAI format, $/token) is normalized to pi's $/M token format. The static list serves as a reasonable fallback.
- **Fast startup** — the 5-second timeout prevents a slow API from blocking pi's startup indefinitely.

### 📋 Negative

- **Two sources of truth** — the static list and the API may diverge. A model present in both could have different pricing or capabilities until the static list is manually updated.
- **Silent fallback** — failures are caught silently (no warning log) to avoid console noise. Troubleshooting model discovery issues requires adding temporary logging.
- **Model ordering** — pi displays models in registration order. API-sourced models may have a different order than the curated static list.
