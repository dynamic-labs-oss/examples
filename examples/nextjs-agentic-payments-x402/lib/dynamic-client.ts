/**
 * Browser-side Dynamic JS SDK client (headless).
 *
 * This is the client used by the website (login, embedded wallet, delegation).
 * It is separate from the server-side delegated-signing client in
 * lib/shared/x402-account.ts, which uses @dynamic-labs-wallet/node-evm.
 */
import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";

export const dynamicClient = createDynamicClient({
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
  metadata: { name: "Agent Wallet" },
});

if (typeof window !== "undefined") {
  addEvmExtension();
}
