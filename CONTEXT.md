# CONTEXT.md — Domain Glossary

This document defines the ubiquitous language for the `pi-clinepass-provider` project. It is a glossary only — free of implementation details, architecture decisions, and code references.

---

## Core Concepts

### ClinePass

A $9.99/month subscription service from Cline that provides access to curated open-weight coding models through an OpenAI-compatible API. ClinePass includes 2-5x standard API rate limits.

- **Not** a model provider itself — it is a gateway to upstream model providers (GLM, Kimi, DeepSeek, etc.)
- Models are identified by the `cline-pass/` prefix (e.g., `cline-pass/deepseek-v4-flash`)

### pi Extension

A TypeScript module loaded by the pi coding agent that registers a model provider, OAuth hooks, and error handlers. The extension receives an `ExtensionAPI` object from the pi runtime and calls `pi.registerProvider()`.

### Provider

A model provider registered with pi. In this extension, the single provider is `"clinepass"`. Models under this provider are referenced as `clinepass/<model-slug>` (e.g., `clinepass/cline-pass/deepseek-v4-flash`).

---

## Authentication

### Static API Key

A long-lived bearer token created from the Cline dashboard (`app.cline.bot → Settings → API Keys`). Does not expire. Used directly as the `Authorization: Bearer <key>` header. Treated as having a 10-year expiry for pi's credential lifecycle.

### WorkOS OAuth Token

A short-lived (~1 hour) access token issued by WorkOS through Cline's OAuth flow. Identified by the `workos:` prefix. Obtained automatically when the user runs `cline auth` and stored in `~/.cline/data/settings/providers.json`.

### WorkOS Refresh Token

A longer-lived token used to obtain a new WorkOS access token when the current one expires. Rotated on each refresh — the old refresh token is single-use.

### WorkOS Token Refresh

The process of exchanging a WorkOS refresh token for a new access token via Cline's server-side endpoint (`POST /api/v1/auth/refresh`). Returns a new access token (with `workos:` prefix) and a rotated refresh token.

### Credential Store

A JSON file that pi uses to persist OAuth credentials. Two formats exist:
- **Cline CLI store**: `~/.cline/data/settings/providers.json` — nested provider structure with `apiKey` (static) or `auth.accessToken` + `auth.refreshToken` (WorkOS OAuth)
- **pi auth store**: `~/.pi/agent/auth.json` — flat or object structure with `apiKey`, `clinepass` (string), or `clinepass.access` (OAuth object)

---

## Model Lifecycle

### Static Model Catalog

A hardcoded list of 10 curated models (GLM-5.2, Kimi K2.7 Code, Kimi K2.6, DeepSeek V4 Pro, DeepSeek V4 Flash, MiMo-V2.5, MiMo-V2.5-Pro, MiniMax M3, Qwen3.7 Max, Qwen3.7 Plus) with reference pricing, context windows, and token limits.

### Dynamic Model Discovery

A runtime fetch from Cline's `/api/v1/models` endpoint (OpenAI-compatible format) that returns the live model list. Models not prefixed with `cline-pass/` are filtered out. Falls back to the static catalog on any error (network failure, 404, parse error, empty list).

### Model Compatibility Override

A per-model configuration that tells pi how to handle model-specific behaviors (e.g., `thinkingFormat: "zai"` for GLM models). Currently unused — all models rely on pi's default `openai-completions` handling.

---

## Error Handling

### Error Classification

Mapping raw API error messages to user-friendly, actionable messages. Three categories:
- **Not subscribed** (403, forbidden) — user lacks a ClinePass subscription
- **Auth expired** (401, unauthorized, invalid API key) — credentials need refresh
- **Rate limited** (429, too many requests) — temporary throttle

### Error Pipeline

A three-stage process: **Filter** (is this a ClinePass error?), **Classify** (what kind of error?), **Deliver** (show the user a friendly message via pi's notification UI or console.error fallback).

### Error Surface

The `message_end` event handler registered with pi. Only acts on ClinePass errors — non-ClinePass errors and non-error messages are silently ignored.

---

## Token Lifecycle

### Token Sanitization

Removing terminal paste wrappers (bracketed paste sequences), control characters, and leading/trailing whitespace from API key input. Applied during the manual paste `/login` flow to clean up keys that may have been corrupted by terminal copy-paste mechanics.

### Token Refresh Margin

A window before a WorkOS token's nominal expiry during which a proactive refresh is triggered. Prevents race conditions where a token expires mid-request.

### Token Prefix (`workos:`)

A string prefix identifying WorkOS OAuth access tokens. Required by Cline's chat API as part of the Bearer token. The refresh endpoint may return bare JWTs — the prefix is added if missing.

---
