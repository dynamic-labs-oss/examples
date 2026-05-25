"use client";

import dynamic from "next/dynamic";

const SubscriptionsInterface = dynamic(
  () =>
    import("@/components/SubscriptionsInterface").then(
      (m) => m.SubscriptionsInterface
    ),
  { ssr: false }
);

export default function Main() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9F9] text-[#030303]">
      <SubscriptionsInterface />
    </div>
  );
}
