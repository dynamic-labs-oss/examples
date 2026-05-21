import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addSolanaExtension } from "@dynamic-labs-sdk/solana";

export const dynamicClient = createDynamicClient({
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
  metadata: {
    name: "Kalshi Demo",
  },
});

if (typeof window !== "undefined") {
  addSolanaExtension();
}
