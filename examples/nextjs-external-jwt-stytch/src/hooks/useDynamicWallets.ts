import { getWalletAccounts } from "@dynamic-labs-sdk/client";

import { useDynamicClientState } from "./useDynamicClientState";

/**
 * Hook that provides access to the current Dynamic wallet accounts.
 *
 * @returns Array of wallet accounts associated with the current user session, or empty array if not available
 */
export const useDynamicWallets = () =>
  useDynamicClientState(
    "walletAccountsChanged",
    (client) => getWalletAccounts(client),
    [],
  );
