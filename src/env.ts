/**
 * ClinePass constants and environment helpers.
 *
 * @module clinepass-env
 */

export const DEFAULT_API_BASE = "https://api.cline.bot";
export const DEFAULT_ENDPOINT = "/api/v1/chat/completions";
export const ENV_API_KEY = "CLINE_API_KEY";

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

/**
 * Remove terminal paste wrappers and control chars from API key input.
 */
export function sanitizeApiKey(input: string): string {
  const esc = String.fromCharCode(27);
  return input
    .replaceAll(`${esc}[200~`, "")
    .replaceAll(`${esc}[201~`, "")
    .replaceAll("[200~", "")
    .replaceAll("[201~", "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
}

export function buildEndpointUrl(base: string): string {
  return `${base}${DEFAULT_ENDPOINT}`;
}
