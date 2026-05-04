import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";
import { addSolanaExtension } from "@dynamic-labs-sdk/solana";

export const dynamicClient = createDynamicClient({
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
  metadata: { name: "LiFi Cross-Chain Swaps" },
});

addEvmExtension();
addSolanaExtension();
