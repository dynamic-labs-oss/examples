import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";
import { addSolanaExtension } from "@dynamic-labs-sdk/solana";
import { env } from "./env";

// Create the Dynamic client once. Extensions must be registered immediately
// after createDynamicClient() and before initialization completes.
export const dynamicClient = createDynamicClient({
  environmentId: env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
  metadata: { name: "MoneyGram Ramp Demo" },
});

// Register EVM and Solana extensions
addEvmExtension();
addSolanaExtension();
