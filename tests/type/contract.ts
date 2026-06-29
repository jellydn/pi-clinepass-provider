/**
 * Type-level contract test: verify that our extension conforms to pi's
 * `ExtensionAPI` contract. If pi changes the contract in a breaking way,
 * this file will fail to compile — catching the mismatch at build time
 * rather than at runtime.
 *
 * @module clinepass-contract-test
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension from "../../src/index.js";

// If pi's ExtensionAPI changes (e.g. new required fields, different
// function signature), TypeScript will error here.
const _contract: (api: ExtensionAPI) => Promise<void> = extension;
void _contract;
