import { createClient, getNetworksData } from "@dynamic-labs/client";
import { DynamicWaasSVMConnectors } from "@dynamic-labs/waas-svm";

export const dynamicClient = createClient({
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
  appName: "Kamino Earn with Dynamic",
}).extend(DynamicWaasSVMConnectors());

/**
 * Returns the Solana RPC URL configured in the Dynamic dashboard.
 * Throws if Dynamic has not been configured with a Solana network.
 */
export function getSolanaRpcUrl(): string {
  if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  }
  const networks = getNetworksData(dynamicClient);
  const solana = networks.find((n) => n.chain === "SOL");
  const url = solana?.rpcUrls.http[0];
  if (!url) {
    throw new Error(
      "No Solana RPC URL found. Set NEXT_PUBLIC_SOLANA_RPC_URL or add a Solana network in your Dynamic dashboard settings."
    );
  }
  return url;
}
