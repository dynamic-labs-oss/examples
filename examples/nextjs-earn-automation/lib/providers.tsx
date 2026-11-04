"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicProvider, useOnEvent } from "@dynamic-labs-sdk/react-hooks";
import {
  createWaasWalletAccounts,
  getChainsMissingWaasWalletAccounts,
} from "@dynamic-labs-sdk/client/waas";
import { dynamicClient } from "@/lib/dynamic/client";

// The JS SDK does not create the embedded wallet automatically. Create any
// missing WaaS wallets as soon as the user signs in.
function WaasBootstrap() {
  useOnEvent({
    event: "userChanged",
    listener: async ({ user }) => {
      if (!user) return;
      const missingChains = getChainsMissingWaasWalletAccounts();
      if (missingChains.length === 0) return;
      await createWaasWalletAccounts({ chains: missingChains });
    },
  });
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // useState so the QueryClient isn't shared across server requests.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <DynamicProvider client={dynamicClient}>
        <WaasBootstrap />
        {children}
      </DynamicProvider>
    </QueryClientProvider>
  );
}
