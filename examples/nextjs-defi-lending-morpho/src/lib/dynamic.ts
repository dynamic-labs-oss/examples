import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";

export const dynamicClient = createDynamicClient({
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
  metadata: { name: "Morpho Lending" },
});

if (typeof window !== "undefined") {
  addEvmExtension();
}

// No-op on clients that auto-initialize; called by useAuth on mount.
export async function initDynamic(): Promise<void> {}
