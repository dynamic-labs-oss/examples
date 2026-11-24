import {
  createDynamicClient,
  initializeClient,
  type DynamicClient,
} from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";
import { addSolanaExtension } from "@dynamic-labs-sdk/solana";
import { SOLANA_RPC_URL } from "./solana/config";

let _client: DynamicClient | null = null;

export function getClient(): DynamicClient {
  if (!_client) {
    _client = createDynamicClient({
      autoInitialize: false,
      environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
      metadata: { name: "Subscriptions" },
      transformers: {
        // Point Solana Devnet (networkId 103) at our own RPC. `dyn` can't set
        // per-network RPC URLs, and this keeps the wallet and the app's own
        // reads on the same endpoint.
        networksData: (networks) =>
          networks.map((n) =>
            String(n.networkId) === "103" ? { ...n, rpcUrls: { http: [SOLANA_RPC_URL] } } : n,
          ),
      },
    });
    addEvmExtension(_client);
    addSolanaExtension(_client);
    void initializeClient(_client);
  }
  return _client;
}

// Lazy proxy so modules can use `dynamicClient` like a plain client without
// evaluating window-dependent code during SSR/prerendering.
export const dynamicClient = new Proxy({} as DynamicClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver);
  },
});
