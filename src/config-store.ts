/**
 * Cline CLI configuration store traversal helpers.
 *
 * Owns the shared boilerplate for navigating and parsing Cline CLI
 * configuration stores (providers.json, auth.json): file path resolution,
 * JSON parsing with ENOENT suppression, and provider settings iteration.
 *
 * Both auth.ts (static API key extraction) and workos.ts (WorkOS OAuth
 * credential extraction) depend on this module for file-walking logic.
 *
 * @module clinepass-config-store
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isRecord } from "./utils.js";

function isMissingAuthFileError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "ENOENT") return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("ENOENT") || msg.includes("not found");
}

// ─── Options ────────────────────────────────────────────────────────────────

/**
 * I/O options for store traversal functions. All fields are injectable for
 * testability, with sensible production defaults.
 */
export interface AuthKeyOptions {
  env?: Record<string, string | undefined>;
  authPaths?: readonly string[];
  homeDir?: () => string;
  readFile?: (path: string) => string;
  fileExists?: (path: string) => boolean;
}

// ─── Path Resolution ────────────────────────────────────────────────────────

/**
 * Default auth file paths checked in order.
 *
 * 1. ~/.cline/data/settings/providers.json — Cline CLI credentials (nested)
 * 2. ~/.pi/agent/auth.json — pi's OAuth credentials store
 */
export function defaultAuthPaths(home: string): string[] {
  return [
    join(home, ".cline", "data", "settings", "providers.json"),
    join(home, ".pi", "agent", "auth.json"),
  ];
}

// ─── File Walking ───────────────────────────────────────────────────────────

/**
 * Iterate auth file paths in order, parsing JSON from each and extracting
 * a value. Handles the shared boilerplate: resolving I/O options, iterating
 * paths, try/catch with ENOENT suppression, and warning on corrupt files.
 *
 * Shared between resolveApiKey (static key extraction) and
 * resolveClineAuthCredentials (WorkOS credential extraction) — both need
 * the same file-walking logic with different extractors.
 *
 * @param options Auth I/O options (injectable for testing)
 * @param extract Called with each successfully parsed JSON object;
 *                return undefined to skip to the next file, or a value to stop
 */
export function walkAuthPaths<T>(
  options: AuthKeyOptions,
  extract: (parsed: Record<string, unknown>) => T | undefined,
): T | undefined {
  const home = options.homeDir?.() ?? homedir();
  const authPaths = options.authPaths ?? defaultAuthPaths(home);
  const readFile = options.readFile ?? ((p: string) => readFileSync(p, "utf-8"));
  const fileExists = options.fileExists ?? ((p: string) => existsSync(p));

  for (const authPath of authPaths) {
    let parsed: unknown;
    try {
      if (!fileExists(authPath)) continue;
      parsed = JSON.parse(readFile(authPath));
    } catch (e) {
      // Distinguish "file absent" (expected, skip silently) from
      // "file present but corrupt/unreadable" (actionable, warn).
      // Never log file contents or the resolved key.
      if (!isMissingAuthFileError(e)) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[clinepass] Warning: failed to read auth file ${authPath}: ${msg}`);
      }
      continue;
    }

    if (!isRecord(parsed)) continue;

    const result = extract(parsed);
    if (result !== undefined) return result;
  }
  return undefined;
}

/**
 * Walk Cline CLI provider entries, extracting a value from each provider's
 * settings object. Iterates both "cline-pass" and "cline" provider keys.
 *
 * Shared between auth.ts (static API key extraction) and workos.ts (WorkOS
 * OAuth credential extraction) — both need to navigate the same
 * providers["cline-pass"|"cline"].settings path.
 *
 * @param parsed A parsed providers.json object
 * @param extract Called with each provider's settings record; return undefined
 *                to skip to the next provider, or a value to stop iteration
 */
export function walkClineProviderSettings<T>(
  parsed: Record<string, unknown>,
  extract: (settings: Record<string, unknown>) => T | undefined,
): T | undefined {
  if (!isRecord(parsed)) return undefined;
  const providers = isRecord(parsed.providers) ? parsed.providers : undefined;
  if (!providers) return undefined;

  for (const key of ["cline-pass", "cline"]) {
    const provider = isRecord(providers[key]) ? providers[key] : undefined;
    if (!provider) continue;
    const settings = isRecord(provider.settings) ? provider.settings : undefined;
    if (!settings) continue;
    const result = extract(settings);
    if (result !== undefined) return result;
  }
  return undefined;
}
