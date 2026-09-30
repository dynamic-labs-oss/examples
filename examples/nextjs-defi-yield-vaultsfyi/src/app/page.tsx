"use client";

import dynamic from "next/dynamic";

const YieldInterface = dynamic(
  () => import("@/components/YieldInterface"),
  { ssr: false },
);

export default function Home() {
  return <YieldInterface />;
}
