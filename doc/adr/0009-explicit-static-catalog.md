# 9. Explicit static catalog with release-time lineup verification

Date: 2026-11-02

## Status

Accepted after explicit approval for [issue #101](https://github.com/jellydn/pi-clinepass-provider/issues/101). Supersedes [ADR 0004](0004-dynamic-model-discovery.md).

## Context

The public `/api/v1/models` returns vendor IDs, not the `cline-pass/` IDs required by the old discovery filter. The issue author reports the same result with authenticated credentials. A live public check returned 435 vendor entries and zero pass entries.

Cline's [SDK](https://github.com/cline/cline/blob/a6507a62a147db4a35e27f4294589742ccac5060/sdk/packages/core/src/services/llms/cline-recommended-models.ts#L265-L301) and VS Code client use `/api/v1/ai/cline/recommended-models`. Its `clinePass` bucket supplies exact pass IDs but no pricing, token limits, input modalities, or thinking maps. It is a first-party client-used feed, not a documented stable third-party metadata or account-entitlement API.

## Decision

Register only the curated `MODELS` catalog, without startup discovery or credential-store reads for model listing. Preserve its explicit request IDs, pricing, limits, modalities, and thinking maps. Remove discovery-only parsers, generic unknown-model defaults, and retired-ID filtering that no longer has a runtime input.

Use the pass feed for a separate release-time full-set comparison. The check reports all missing and remote-only IDs, fails on malformed data or unavailable upstream service, and never changes the catalog. Every difference needs review; an omission is not proof of retirement. Intentional exclusions must be documented and reviewed, not silently filtered.

Do not infer pass membership from vendor IDs. An explicit vendor mapping would still need independent membership and metadata evidence and would not solve future unknown models. A hybrid automatic-registration design is rejected for this change: missing metadata must not turn into assumed capabilities, generic token limits, or zero reference prices. Existing null fallback handling was not itself the bug.

## Consequences

- Registration is deterministic and works without a catalog network request or credentials.
- Remote or null metadata cannot replace curated values or introduce unreviewed models.
- New models, retirements, prices, and capability changes require a package release. This is an accepted maintenance cost.
- The release-only checker needs Bun and network access; unit tests remain offline and run on the existing Node CI matrix.
- Lineup verification does not prove metadata correctness, account entitlement, or working chat/image/reasoning routes. Those checks remain separate.
- PR #100 owns the November lineup refresh; this follow-up does not copy its catalog changes.
