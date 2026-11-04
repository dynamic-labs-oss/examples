import {
  createDynamicClient,
  initializeClient,
} from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";
import { env } from "@/env";

// Module-level singleton. Only import this from "use client" files — it must
// never be evaluated by a Server Component.
export const dynamicClient = createDynamicClient({
  autoInitialize: false,
  environmentId: env.NEXT_PUBLIC_DYNAMIC_ENV_ID,
  metadata: {
    name: "Earn Automation",
    universalLink:
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000",
  },
});

// Extensions must be registered right after createDynamicClient(), before
// initialization completes. No client argument needed — there is only one.
// The EVM extension touches `window`, so it (and init) are browser-only; the
// SSR pass renders with no wallets, which the UI gates on useInitStatus().
if (typeof window !== "undefined") {
  addEvmExtension();
  void initializeClient();
}
