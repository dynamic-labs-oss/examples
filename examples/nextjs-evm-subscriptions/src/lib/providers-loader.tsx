"use client";

import dynamic from "next/dynamic";

// The Dynamic SDK touches window at init — load Providers client-only.
const Providers = dynamic(() => import("./providers"), { ssr: false });

export default function ProvidersLoader({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
