"use client";

import { Toaster } from "sonner";
import { Providers as WalletProviders } from "@/lib/providers";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProviders>
      {children}
      <Toaster position="bottom-center" />
    </WalletProviders>
  );
}
