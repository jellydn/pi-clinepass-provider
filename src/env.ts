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
 */
export function resolveApiBase(env: Record<string, string | undefined> = process.env): string {
  return env.CLINE_API_BASE ?? DEFAULT_API_BASE;
}

/**
 * Remove terminal paste wrappers and control chars from API key input.
 */
export function sanitizeApiKey(input: string): string {
  const esc = String.fromCharCode(27);
  return Array.from(
    input
      .replaceAll(`${esc}[200~`, "")
      .replaceAll(`${esc}[201~`, "")
      .replaceAll("[200~", "")
      .replaceAll("[201~", ""),
  )
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .trim();
}

/**
 * Build the full chat completions endpoint URL from a base URL.
 *
 * Utility for documentation and tests — the actual extension uses pi's
 * built-in openai-completions streaming, which appends `/chat/completions`
 * to the provider's baseUrl (`${apiBase}/api/v1`) automatically.
 */
export function buildEndpointUrl(base: string): string {
  return `${base}${DEFAULT_ENDPOINT}`;
}
