/**
 * ClinePass error classification — maps provider error messages to
 * user-friendly, actionable messages.
 *
 * @module clinepass-errors
 */

/** Error types returned by the ClinePass API. */
export type ClinePassErrorType = "not_subscribed" | "auth_expired" | "rate_limited" | "unknown";

/**
 * Check if a lowercased string matches any of the given patterns.
 */
function matchesAny(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(p));
}

/**
 * User-friendly error messages for ClinePass-specific failures.
 */
export const CLINEPASS_ERROR_MESSAGES: Record<ClinePassErrorType, string> = {
  not_subscribed:
    "ClinePass subscription required. Visit app.cline.bot to subscribe, or run `pi /login` to re-authenticate. If your organization manages ClinePass, contact your admin for access.",
  auth_expired:
    "ClinePass authentication expired. Run `pi /login` and select ClinePass to refresh your credentials.",
  rate_limited:
    "ClinePass rate limit reached. Wait a moment and try again, or upgrade your plan at app.cline.bot.",
  unknown: "ClinePass request failed. Check your subscription at app.cline.bot or run `pi /login`.",
};

/**
 * Classify a ClinePass API error message into a specific error type.
 */
export function classifyClinePassError(errorMessage: string): {
  type: ClinePassErrorType;
  message: string;
} {
  const lower = errorMessage.toLowerCase();

  if (matchesAny(lower, ["403", "forbidden", "subscription required", "not subscribed"])) {
    return { type: "not_subscribed", message: CLINEPASS_ERROR_MESSAGES.not_subscribed };
  }

  if (matchesAny(lower, ["401", "unauthorized", "invalid api key", "invalid_api_key"])) {
    return { type: "auth_expired", message: CLINEPASS_ERROR_MESSAGES.auth_expired };
  }

  if (matchesAny(lower, ["429", "rate limit", "too many requests", "rate_limit"])) {
    return { type: "rate_limited", message: CLINEPASS_ERROR_MESSAGES.rate_limited };
  }

  return { type: "unknown", message: CLINEPASS_ERROR_MESSAGES.unknown };
}
