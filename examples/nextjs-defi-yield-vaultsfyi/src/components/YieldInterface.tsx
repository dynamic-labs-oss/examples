"use client";

import { useState } from "react";
import { useWallet } from "@/lib/providers";
import type { VaultOption } from "@/lib/useDiscover";
import { DiscoverPanel } from "./DiscoverPanel";
import { ActionPanel } from "./ActionPanel";
import { PositionsPanel } from "./PositionsPanel";
import { RewardsPanel } from "./RewardsPanel";

export default function YieldInterface() {
  const { evmAccount, loggedIn } = useWallet();
  const [selected, setSelected] = useState<VaultOption | null>(null);

  const address = evmAccount?.address;

  return (
    <div className="container mx-auto px-4 py-12 space-y-6">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-semibold tracking-tight mb-3">
          vaults.fyi Yield with Dynamic
        </h1>
        <p className="text-base text-[#606060] max-w-2xl mx-auto">
          Five operations against 1,000+ vaults: discover, deposit, track,
          withdraw, claim. Wallet via Dynamic embedded MPC; transactions via
          vaults.fyi calldata + viem.
        </p>
      </div>

      <DiscoverPanel selected={selected} onSelect={(vault) => setSelected(vault)} />

      {loggedIn && address && selected && (
        <ActionPanel userAddress={address} selected={selected} />
      )}

      {loggedIn && address && (
        <>
          <PositionsPanel userAddress={address} />
          <RewardsPanel userAddress={address} />
        </>
      )}

      {!loggedIn && (
        <p className="text-center text-sm text-[#606060]">
          Sign in via the header to unlock deposit, withdraw, and claim flows.
        </p>
      )}
    </div>
  );
}
