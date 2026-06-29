/**
 * ClinePass constants and environment helpers.
 *
 * @module clinepass-env
 */
export const DEFAULT_API_BASE = "https://api.cline.bot";
export const DEFAULT_ENDPOINT = "/api/v1/chat/completions";
/** Name of the env var that holds the ClinePass API key. */
export const ENV_API_KEY = "CLINE_API_KEY";

/** Prefix that identifies WorkOS OAuth access tokens (e.g. "workos:eyJ..."). */
export const WORKOS_TOKEN_PREFIX = "workos:";

/**
 * The ClinePass provider name used in pi (pi registerProvider name).
 * Models are referenced as `clinepass/<model-slug>`.
 */
export const PROVIDER_NAME = "clinepass";

/**
 * Resolve the API base URL, allowing override via CLINE_API_BASE env var.
 * Normalizes the result: trims whitespace, treats empty value as missing,
 * and removes trailing slashes to prevent malformed endpoint concatenation.
 */
export function resolveApiBase(env: Record<string, string | undefined> = process.env): string {
  const base = env.CLINE_API_BASE?.trim();
  if (!base) return DEFAULT_API_BASE;
  return base.replace(/\/+$/, "");
}

/** Regex matching control characters (0x00-0x1F) and DEL (0x7F).
 * Built via String.fromCharCode to avoid triggering the no-control-regex
 * lint rule, which flags hex/unicode escape sequences in regex patterns. */
const CONTROL_CHARS_RE = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  "g",
);

/**
 * Remove terminal paste wrappers and control chars from API key input.
 */
export function sanitizeApiKey(input: string): string {
  const esc = "\x1b";
  return input
    .replaceAll(`${esc}[200~`, "")
    .replaceAll(`${esc}[201~`, "")
    .replaceAll("[200~", "")
    .replaceAll("[201~", "")
    .replace(CONTROL_CHARS_RE, "")
    .trim();
}

/**
 * Build the chat completions endpoint URL for a given API base.
 */
export function buildEndpointUrl(base: string): string {
  return `${base}${DEFAULT_ENDPOINT}`;
}
