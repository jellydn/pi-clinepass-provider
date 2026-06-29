/**
 * ClinePass error handler — owns the full error surface pipeline.
 *
 * This module is the single seam between pi's `message_end` events and
 * user-facing error messages. It owns three responsibilities:
 *
 * 1. **Filter** — is this a ClinePass error worth surfacing? (stopReason=error,
 *    errorMessage present, provider matches)
 * 2. **Classify** — what type of error is it? (delegates to `errors.ts`)
 * 3. **Deliver** — surface the friendly message via `ctx.ui.notify` or
 *    `console.error` fallback
 *
 * The interface is intentionally narrow: a single function that accepts the
 * raw pi event + context pair. Callers (`index.ts`) need only write
 * `pi.on("message_end", handleClinePassError)` — all complexity sits behind
 * this seam.
 *
 * @module clinepass-error-handler
 */

import { classifyClinePassError } from "./errors.js";
import { PROVIDER_NAME } from "./env.js";

/**
 * Handle a `message_end` event for the ClinePass provider.
 *
 * Filters for ClinePass-specific errors, classifies them, and surfaces a
 * user-friendly message. Non-ClinePass errors and non-error messages are
 * silently ignored (early return).
 *
 * @param event The raw pi `message_end` event
 * @param ctx The pi extension context (UI access, current model)
 */
export function handleClinePassError(
  event: { message: unknown },
  ctx: {
    hasUI: boolean;
    ui: { notify: (msg: string, type: "info" | "warning" | "error") => void };
    model?: { provider?: string };
  },
): void {
  // Guard against missing or null event.message
  if (!event.message) return;

  // The message object carries stopReason and errorMessage from the stream.
  // Access defensively since AgentMessage may not export these fields in
  // its public type definition.
  const msg = event.message as {
    stopReason?: string;
    errorMessage?: string;
    provider?: string;
  };

  // ─── Filter ───────────────────────────────────────────────────────────
  // Only handle error stop reason with an error message present.
  if (msg.stopReason !== "error" || !msg.errorMessage) return;

  // Only handle errors from our provider (check both the message's provider
  // field and the current model context as fallback).
  const provider = msg.provider ?? ctx.model?.provider;
  if (provider !== PROVIDER_NAME) return;

  // ─── Classify + Deliver ───────────────────────────────────────────────
  const { message: friendlyMessage } = classifyClinePassError(msg.errorMessage);

  if (ctx.hasUI) {
    ctx.ui.notify(friendlyMessage, "error");
  } else {
    console.error(`[clinepass] ${friendlyMessage}`);
  }
}
