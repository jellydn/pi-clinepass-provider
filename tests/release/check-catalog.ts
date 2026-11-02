/** Release-only lineup check. Never used for runtime model registration. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApiBase } from "../../src/env.js";
import { modelIds } from "../../src/models.js";
import { isRecord } from "../../src/utils.js";

/** Compare every curated ID with the first-party pass bucket, without inferring metadata or access. */
export function comparePassCatalog(catalogIds: readonly string[], payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.clinePass) || !payload.clinePass.length) {
    throw new Error("Missing or empty clinePass lineup");
  }

  const remoteIds = new Set<string>();
  for (const entry of payload.clinePass) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      !/^cline-pass\/[^/\s]+$/.test(entry.id)
    ) {
      throw new Error("Invalid ClinePass ID in lineup");
    }
    if (remoteIds.has(entry.id)) throw new Error(`Duplicate ClinePass ID: ${entry.id}`);
    remoteIds.add(entry.id);
  }

  const catalog = new Set(catalogIds);
  return {
    missing: catalogIds.filter((id) => !remoteIds.has(id)),
    unexpected: [...remoteIds].filter((id) => !catalog.has(id)),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const url = `${resolveApiBase()}/api/v1/ai/cline/recommended-models`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`Lineup request failed: HTTP ${response.status}`);
    const differences = comparePassCatalog(modelIds(), await response.json());
    console.log(JSON.stringify(differences, null, 2));
    if (differences.missing.length || differences.unexpected.length) {
      throw new Error(
        "Catalog differs from pass lineup. Resolve or document every difference before release.",
      );
    }
    console.log(
      "All curated model IDs match the ClinePass lineup. Metadata and account access still need verification.",
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Catalog verification failed");
    process.exitCode = 1;
  }
}
