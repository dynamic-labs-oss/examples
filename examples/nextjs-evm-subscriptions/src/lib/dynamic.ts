import {
  createDynamicClient,
  initializeClient,
  type DynamicClient,
} from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";

let _client: DynamicClient | null = null;

export function getClient(): DynamicClient {
  if (!_client) {
    _client = createDynamicClient({
      autoInitialize: false,
      environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
      metadata: { name: "EVM Subscriptions" },
    });
    addEvmExtension(_client);
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
