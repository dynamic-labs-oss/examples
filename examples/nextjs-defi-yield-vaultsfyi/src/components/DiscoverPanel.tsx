"use client";

import { useDiscover, type VaultOption } from "@/lib/useDiscover";
import { useWallet } from "@/lib/providers";
import {
  SUPPORTED_NETWORKS,
  getNetworkConfigOrDefault,
} from "@/lib/networks";
import { formatApy } from "@/lib/utils";
import { Card } from "./ui/card";

export function DiscoverPanel({
  selected,
  onSelect,
}: {
  selected: VaultOption | null;
  onSelect: (vault: VaultOption) => void;
}) {
  const { chainId, setChainId } = useWallet();
  const network = getNetworkConfigOrDefault(chainId);
  const { data, isLoading, error } = useDiscover(chainId);

  return (
    <Card
      title={`Recommended USDC vaults on ${network.displayName}`}
      subtitle="Top USDC vaults on the active chain sorted by 7-day APY. Complex multi-step flows hidden for clarity."
    >
      <div className="flex items-center gap-2 mb-3">
        {Object.values(SUPPORTED_NETWORKS).map((net) => (
          <button
            key={net.chainId}
            onClick={() => setChainId(net.chainId)}
            className={`text-xs px-3 py-1.5 rounded border transition ${
              chainId === net.chainId
                ? "border-[#4779FF] bg-[#4779FF]/10 text-[#4779FF] font-medium"
                : "border-[#DADADA] hover:bg-[#F9F9F9]"
            }`}
          >
            {net.displayName}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-[#606060]">Loading…</p>}
      {error && (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      )}
      {data?.length === 0 && (
        <p className="text-sm text-[#606060]">No vaults found on this chain.</p>
      )}
      <div className="space-y-2">
        {data?.slice(0, 5).map((vault) => {
          const isSelected = selected?.vaultId === vault.vaultId;
          return (
            <button
              key={vault.vaultId}
              onClick={() => onSelect(vault)}
              className={`w-full flex items-center justify-between p-3 border rounded transition ${
                isSelected
                  ? "border-[#4779FF] bg-[#4779FF]/5 ring-1 ring-[#4779FF]"
                  : "border-[#DADADA] hover:bg-[#F9F9F9]"
              }`}
            >
              <div className="text-left">
                <div className="text-sm font-medium">
                  {vault.protocol.name} · {vault.name}
                </div>
                <div className="text-xs text-[#606060] truncate max-w-[320px]">
                  {vault.address}
                </div>
              </div>
              <div className="text-sm text-green-700 font-semibold">
                {formatApy(vault.apy["7day"].total)}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
