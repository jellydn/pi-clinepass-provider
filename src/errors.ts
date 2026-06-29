/**
 * ClinePass error classification — maps provider error messages to
 * user-friendly, actionable messages.
 *
 * @module clinepass-errors
 */

/**
 * Classified error type from a ClinePass API response.
 *
 * ClinePass returns specific HTTP status codes for different failure modes
 * (per Cline PR #11355):
 * - 403: user not subscribed, or ClinePass used at organization level
 * - 401: authentication credentials invalid or expired
 * - 429: rate limit exceeded
 */
export type ClinePassErrorType = "not_subscribed" | "auth_expired" | "rate_limited" | "unknown";

/**
 * User-friendly error messages for ClinePass-specific failures.
 */
export const CLINEPASS_ERROR_MESSAGES: Record<ClinePassErrorType, string> = {
  not_subscribed:
    "ClinePass subscription required. Visit app.cline.bot to subscribe, or run `pi /login` to re-authenticate.",
  auth_expired:
    "ClinePass authentication expired. Run `pi /login` and select ClinePass to refresh your credentials.",
  rate_limited:
    "ClinePass rate limit reached. Wait a moment and try again, or upgrade your plan at app.cline.bot.",
  unknown: "ClinePass request failed. Check your subscription at app.cline.bot or run `pi /login`.",
};

/**
 * Classify a ClinePass API error message into a specific error type.
 *
 * The OpenAI SDK surfaces HTTP error status codes and response body text in
 * the error message. This function pattern-matches against common 403/401/429
 * indicators to produce a clear, actionable message for the user.
 *
 * @param errorMessage The raw error message from the provider response
 * @returns The classified error type and a user-friendly message
 */
export function classifyClinePassError(errorMessage: string): {
  type: ClinePassErrorType;
  message: string;
} {
  const lower = errorMessage.toLowerCase();

  // 403 — not subscribed or org-level restriction (per Cline PR #11355)
  if (
    lower.includes("403") ||
    lower.includes("forbidden") ||
    lower.includes("subscription required") ||
    lower.includes("not subscribed")
  ) {
    return { type: "not_subscribed", message: CLINEPASS_ERROR_MESSAGES.not_subscribed };
  }

  // 401 — auth expired or invalid credentials
  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid_api_key")
  ) {
    return { type: "auth_expired", message: CLINEPASS_ERROR_MESSAGES.auth_expired };
  }

  // 429 — rate limited
  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("rate_limit")
  ) {
    return { type: "rate_limited", message: CLINEPASS_ERROR_MESSAGES.rate_limited };
  }

  return { type: "unknown", message: CLINEPASS_ERROR_MESSAGES.unknown };
}
