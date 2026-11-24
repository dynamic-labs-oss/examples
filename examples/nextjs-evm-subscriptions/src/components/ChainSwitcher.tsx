"use client";

import { useChain, type Chain } from "@/lib/chain";
import { CHAIN_NAME } from "@/lib/config";
import { SOLANA_CHAIN_NAME } from "@/lib/solana/config";

const OPTIONS: { id: Chain; label: string; sub: string }[] = [
  { id: "evm", label: "EVM", sub: CHAIN_NAME },
  { id: "solana", label: "Solana", sub: SOLANA_CHAIN_NAME },
];

export function ChainSwitcher() {
  const { chain, setChain } = useChain();
  return (
    <div
      role="tablist"
      aria-label="Chain"
      className="inline-grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#F4F4F4] text-sm font-medium"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={chain === o.id}
          type="button"
          onClick={() => setChain(o.id)}
          className={`px-4 py-1.5 rounded-md transition-colors flex items-baseline gap-2 ${
            chain === o.id ? "bg-white text-[#030303] shadow-sm" : "text-[#606060] hover:text-[#030303]"
          }`}
        >
          {o.label}
          <span className="hidden sm:inline text-xs font-normal text-[#606060]">{o.sub}</span>
        </button>
      ))}
    </div>
  );
}
