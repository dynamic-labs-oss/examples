"use client";

import MultiChainSwap from "@/components/MultiChainSwap";
import Nav from "@/components/nav";

export default function Main() {
  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300 bg-gray-100 text-gray-800">
      <Nav />
      <MultiChainSwap />
    </div>
  );
}
