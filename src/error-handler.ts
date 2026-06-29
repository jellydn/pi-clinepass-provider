import { classifyClinePassError } from "./errors.js";
import { PROVIDER_NAME } from "./env.js";

/**
 * Handle a `message_end` event for the ClinePass provider.
 *
 * Filters for ClinePass-specific errors, classifies them, and surfaces a
 * user-friendly message. Non-ClinePass errors and non-error messages are
 * silently ignored (early return).
 */
export function handleClinePassError(
  event: { message: unknown },
  ctx: {
    hasUI: boolean;
    ui: { notify: (msg: string, type: "info" | "warning" | "error") => void };
    model?: { provider?: string };
  },
): void {
  if (!event.message) return;

  const msg = event.message as {
    stopReason?: string;
    errorMessage?: string;
    provider?: string;
  };

  if (msg.stopReason !== "error" || !msg.errorMessage) return;

  const provider = msg.provider ?? ctx.model?.provider;
  if (provider !== PROVIDER_NAME) return;

  const { message: friendlyMessage } = classifyClinePassError(msg.errorMessage);

  if (ctx.hasUI) {
    ctx.ui.notify(friendlyMessage, "error");
  } else {
    console.error(`[clinepass] ${friendlyMessage}`);
  }
}
