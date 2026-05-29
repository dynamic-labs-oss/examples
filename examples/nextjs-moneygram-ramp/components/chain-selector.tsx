"use client";

import { CHAINS, type MgChain } from "@/lib/chains";
import clsx from "clsx";

const CHAIN_ORDER: MgChain[] = ["base", "ethereum", "solana"];

interface ChainSelectorProps {
  selected: MgChain;
  onChange: (chain: MgChain) => void;
}

export function ChainSelector({ selected, onChange }: ChainSelectorProps) {
  return (
    <div className="flex gap-2">
      {CHAIN_ORDER.map((chain) => (
        <button
          key={chain}
          onClick={() => onChange(chain)}
          className={clsx(
            "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
            selected === chain
              ? "bg-[#4779FF]/10 border border-[#4779FF]/30 text-[#4779FF]"
              : "text-[#606060] hover:text-[#030303] hover:bg-[#F9F9F9] border border-transparent",
          )}
        >
          {CHAINS[chain].name}
        </button>
      ))}
    </div>
  );
}
