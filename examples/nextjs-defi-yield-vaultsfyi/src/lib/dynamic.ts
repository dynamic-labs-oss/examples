import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";

/**
 * Singleton Dynamic client. Mirrors the exact pattern used in
 * dynamic-labs-oss/examples/nextjs-stablecoin-yield-aave/src/lib/dynamic.ts
 * and nextjs-defi-lending-morpho/src/lib/dynamic.ts.
 *
 * `addEvmExtension()` must be called in a browser context to register the
 * EVM-side wallet primitives (createWalletClientForWalletAccount, etc.) on
 * the client. Server-side calls are no-ops.
 */
export const dynamicClient = createDynamicClient({
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
  metadata: { name: "vaults.fyi Yield" },
});

if (typeof window !== "undefined") {
  addEvmExtension();
}
