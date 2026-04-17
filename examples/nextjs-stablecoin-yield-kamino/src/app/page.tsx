"use client";

import dynamic from "next/dynamic";

// Dynamically import to avoid WASM-related SSR issues from
// @kamino-finance/klend-sdk → @orca-so/whirlpools-core
const VaultsInterface = dynamic(
  () => import("@/components/VaultsInterface").then((m) => m.VaultsInterface),
  { ssr: false }
);

export default function Main() {
  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300 bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
      <VaultsInterface />
    </div>
  );
}
