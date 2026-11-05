/**
 * Delegated EVM Credential Loading
 *
 * Thin wrapper over the shared loader, pinning the EVM wallet.json location.
 * See src/lib/delegated-credentials.ts for the security notes.
 */

import { join } from "node:path";
import type { Hex } from "viem";

import { loadDelegatedCredentials } from "../../lib/delegated-credentials";
import type { DelegatedCredentials } from "../../lib/gasless/evm";

/** Load EVM delegation credentials from src/evm/delegated/wallet.json. */
export function loadEvmDelegatedCredentials(): DelegatedCredentials {
  const credentials = loadDelegatedCredentials(
    join(__dirname, "wallet.json"),
    "src/evm/delegated",
  );

  return {
    ...credentials,
    // EVM helpers are typed on Hex; the file stores it as a plain string.
    address: credentials.address as Hex,
  };
}
