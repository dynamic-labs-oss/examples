import {
  createDynamicClient,
  initializeClient,
  type DynamicClient,
} from "@dynamic-labs-sdk/client";
import { addWaasEvmExtension } from "@dynamic-labs-sdk/evm/waas";
import { addWaasSolanaExtension } from "@dynamic-labs-sdk/solana/waas";
import { config } from "./config";

export const dynamicClient: DynamicClient = createDynamicClient({
  environmentId: config.dynamic.environmentId,
  autoInitialize: false,
  metadata: { name: "Iron Finance Ramp" },
});

let initialized = false;

/**
 * Adds the EVM + Solana WaaS extensions and initializes the client.
 * Safe to call multiple times — initialization runs once.
 */
export async function initDynamic(): Promise<void> {
  if (initialized) return;
  initialized = true;
  addWaasEvmExtension(dynamicClient);
  addWaasSolanaExtension(dynamicClient);
  await initializeClient(dynamicClient);
}
