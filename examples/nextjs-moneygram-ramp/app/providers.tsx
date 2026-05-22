"use client";

import { DynamicProvider } from "@dynamic-labs-sdk/react-hooks";
import { Toaster } from "sonner";
import { dynamicClient } from "@/lib/dynamic";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DynamicProvider client={dynamicClient}>
      {children}
      <Toaster position="bottom-center" theme="dark" />
    </DynamicProvider>
  );
}
