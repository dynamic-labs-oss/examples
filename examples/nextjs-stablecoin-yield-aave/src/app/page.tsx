"use client";

import dynamic from "next/dynamic";

const MarketsInterface = dynamic(
  () =>
    import("@/components/MarketsInterface").then((m) => ({
      default: m.MarketsInterface,
    })),
  { ssr: false }
);

export default function Main() {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketsInterface />
    </div>
  );
}
