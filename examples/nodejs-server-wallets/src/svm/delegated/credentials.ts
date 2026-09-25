/**
 * Delegated Solana Credential Loading
 *
 * Thin wrapper over the shared loader, pinning the Solana wallet.json location.
 * See src/lib/delegated-credentials.ts for the security notes.
 */

import { join } from "node:path";

import { loadDelegatedCredentials } from "../../lib/delegated-credentials";
import type { DelegatedCredentials } from "../../lib/gasless/svm";

/** Load Solana delegation credentials from src/svm/delegated/wallet.json. */
export function loadSvmDelegatedCredentials(): DelegatedCredentials {
  return loadDelegatedCredentials(
    join(__dirname, "wallet.json"),
    "src/svm/delegated",
  );
}
