import {
  createDynamicClient,
  getActiveNetworkData,
  initializeClient,
} from "@dynamic-labs-sdk/client";
import { addSolanaExtension } from "@dynamic-labs-sdk/solana";
import { createSolanaRpc } from "@solana/kit";
import type { SolanaWalletAccount } from "@dynamic-labs-sdk/solana";

export const dynamicClient = createDynamicClient({
  autoInitialize: false,
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
  metadata: {
    name: "Solana Subscriptions",
  },
});

addSolanaExtension();
void initializeClient(dynamicClient);

// Creates a kit v2 RPC pointed at the same endpoint the WaaS provider uses.
export async function getKitRpc(walletAccount: SolanaWalletAccount) {
  const { networkData } = await getActiveNetworkData({ walletAccount }, dynamicClient);
  if (!networkData) throw new Error("Could not determine active Solana network");
  return createSolanaRpc(networkData.rpcUrls.http[0]);
}
