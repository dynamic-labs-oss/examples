/**
 * Solana Client Factories
 *
 * SVM counterpart to `clients/evm.ts`: an API-token client for server wallets your
 * application owns, and a delegated client for wallets a user granted access to.
 */

import {
  createDelegatedSvmWalletClient,
  delegatedSignMessage,
  DynamicSvmWalletClient,
} from "@dynamic-labs-wallet/node-svm";

import { Connection, PublicKey } from "@solana/web3.js";

import {
  DYNAMIC_API_TOKEN,
  DYNAMIC_ENVIRONMENT_ID,
  SOLANA_RPC_URL,
} from "../../../constants";

interface ClientProps {
  authToken?: string;
  environmentId?: string;
}

/**
 * Client for Solana wallets a user has delegated to your app.
 *
 * Signing goes through Dynamic using the per-wallet credentials from the
 * delegation webhook — you never hold the user's key shares.
 */
export const delegatedSvmClient = (args?: ClientProps) => {
  const environmentId = args?.environmentId ?? DYNAMIC_ENVIRONMENT_ID;
  const authToken = args?.authToken ?? DYNAMIC_API_TOKEN;
  return createDelegatedSvmWalletClient({
    environmentId,
    apiKey: authToken,
  });
};

/**
 * Client for Solana server wallets your app owns.
 *
 * Authenticated with your environment API token. Like the EVM client, every
 * operation takes explicit `walletMetadata` (and key shares when you hold them).
 */
export const authenticatedSvmClient = async (args?: ClientProps) => {
  const environmentId = args?.environmentId ?? DYNAMIC_ENVIRONMENT_ID;
  const authToken = args?.authToken ?? DYNAMIC_API_TOKEN;
  const client = new DynamicSvmWalletClient({
    environmentId,
    enableMPCAccelerator: true,
  });

  await client.authenticateApiToken(authToken);
  return client;
};

/** Look up a wallet's SOL balance in lamports. */
export async function getLamportBalance(
  address: string,
  rpcUrl: string = SOLANA_RPC_URL,
): Promise<number> {
  const connection = new Connection(rpcUrl, "confirmed");
  return connection.getBalance(new PublicKey(address));
}

/**
 * The authenticated client type, for functions that take one as a parameter.
 *
 * Derived from the factory rather than imported from the SDK, so it tracks the
 * factory's return type automatically.
 */
export type SvmClient = Awaited<ReturnType<typeof authenticatedSvmClient>>;

export { delegatedSignMessage };
