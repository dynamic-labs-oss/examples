/**
 * EVM Client Factories
 *
 * Two ways to authenticate, and the distinction matters: an API-token client acts
 * for wallets your application owns, while a delegated client acts for a user's
 * wallet using credentials they granted — you never hold their key shares.
 */

import {
  createDelegatedEvmWalletClient,
  delegatedSignMessage,
  DynamicEvmWalletClient,
} from "@dynamic-labs-wallet/node-evm";

import { DYNAMIC_API_TOKEN, DYNAMIC_ENVIRONMENT_ID } from "../../../constants";

interface ClientProps {
  authToken?: string;
  environmentId?: string;
}

/**
 * Client for wallets a user has delegated to your app.
 *
 * Signing goes through Dynamic using the per-wallet credentials from the
 * delegation webhook — you never hold the user's key shares.
 */
export const delegatedEvmClient = (args?: ClientProps) => {
  const environmentId = args?.environmentId ?? DYNAMIC_ENVIRONMENT_ID;
  const authToken = args?.authToken ?? DYNAMIC_API_TOKEN;
  const client = createDelegatedEvmWalletClient({
    environmentId,
    apiKey: authToken,
  });
  return client;
};

/**
 * Client for server wallets your app owns.
 *
 * Authenticated with your environment API token. Every operation takes explicit
 * `walletMetadata` (and key shares when you hold them) — the SDK is stateless
 * and keeps no wallet state between calls.
 */
export const authenticatedEvmClient = async (args?: ClientProps) => {
  const environmentId = args?.environmentId ?? DYNAMIC_ENVIRONMENT_ID;
  const authToken = args?.authToken ?? DYNAMIC_API_TOKEN;
  const client = new DynamicEvmWalletClient({
    environmentId,
    enableMPCAccelerator: true,
  });

  await client.authenticateApiToken(authToken);
  return client;
};

export { delegatedSignMessage };

/**
 * The authenticated client type, for functions that take one as a parameter.
 *
 * Derived from the factory rather than imported from the SDK, so it tracks the
 * factory's return type automatically.
 */
export type EvmClient = Awaited<ReturnType<typeof authenticatedEvmClient>>;
