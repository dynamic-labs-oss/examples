import { createDynamicClient, getNetworksData } from "@dynamic-labs-sdk/client";
import { addSolanaExtension } from "@dynamic-labs-sdk/solana";

export const dynamicClient = createDynamicClient({
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
  metadata: {
    name: "Solana Subscriptions",
  },
});

addSolanaExtension();

export function getSolanaRpcUrl(): string {
  if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  }
  const networks = getNetworksData(dynamicClient);
  const solana = networks.find((n) => n.chain === "SOL");
  const url = solana?.rpcUrls.http[0];
  if (!url) {
    throw new Error(
      "No Solana RPC URL found. Set NEXT_PUBLIC_SOLANA_RPC_URL or add a Solana network in your Dynamic dashboard."
    );
  }
  return url;
}
