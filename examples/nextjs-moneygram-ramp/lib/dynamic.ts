import { createDynamicClient, initializeClient, type DynamicClient } from "@dynamic-labs-sdk/client";
import { addWaasEvmExtension } from "@dynamic-labs-sdk/evm/waas";
import { addWaasSolanaExtension } from "@dynamic-labs-sdk/solana/waas";
import { env } from "./env";

export const dynamicClient: DynamicClient = createDynamicClient({
  environmentId: env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
  autoInitialize: false,
  metadata: { name: "MoneyGram Ramp Demo" },
});

let initialized = false;

export async function initDynamic(): Promise<void> {
  if (initialized) return;
  initialized = true;
  addWaasEvmExtension(dynamicClient);
  addWaasSolanaExtension(dynamicClient);
  await initializeClient(dynamicClient);
}
