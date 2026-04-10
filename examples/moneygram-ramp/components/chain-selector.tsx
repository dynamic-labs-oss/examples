"use client";

import clsx from "clsx";
import { CHAINS, type MgChain } from "@/lib/chains";

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
              ? "bg-teal-600/20 border border-teal-600/40 text-teal-400"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent",
          )}
        >
          {CHAINS[chain].name}
        </button>
      ))}
    </div>
  );
}
