"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useVaultsList, useVaultPositions } from "../../lib/hooks";
import { VaultCard } from "@/components/VaultCard";
import { PositionCard } from "@/components/PositionCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useWallet } from "@/lib/providers";
import { createPublicClient, erc20Abi, http, formatUnits } from "viem";
import { mainnet, base, polygon, arbitrum, optimism } from "viem/chains";

const VAULTS_PER_PAGE = 6;

export default function EarnPage() {
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const { evmAccount, loggedIn, chainId } = useWallet();
  const address = evmAccount?.address;
  const isConnected = loggedIn && !!evmAccount;
  const { vaults, loading, error } = useVaultsList("tvl-desc");
  const { positions, loading: positionsLoading } = useVaultPositions(address, vaults, refreshKey);
  const [assetBalances, setAssetBalances] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!evmAccount || vaults.length === 0) return;
    const assetAddresses = [...new Set(vaults.map((v) => v.assetAddress).filter(Boolean))];
    if (assetAddresses.length === 0) return;
    const CHAINS = [mainnet, base, polygon, arbitrum, optimism];
    const viemChain = CHAINS.find((c) => c.id === chainId) ?? base;
    const publicClient = createPublicClient({ chain: viemChain, transport: http() });
    Promise.all(
      assetAddresses.map(async (addr) => {
        try {
          const [rawBalance, decimals] = await Promise.all([
            publicClient.readContract({
              address: addr as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [evmAccount.address as `0x${string}`],
            }),
            publicClient.readContract({
              address: addr as `0x${string}`,
              abi: erc20Abi,
              functionName: "decimals",
            }),
          ]);
          return [addr.toLowerCase(), formatUnits(rawBalance, decimals)] as const;
        } catch {
          return [addr.toLowerCase(), "0"] as const;
        }
      })
    ).then((entries) => {
      const map: Record<string, string> = {};
      for (const [addr, balance] of entries) map[addr] = balance;
      setAssetBalances(map);
    }).catch(() => {});
  }, [evmAccount, chainId, vaults.length, refreshKey]);

  const totalPages = Math.ceil(vaults.length / VAULTS_PER_PAGE);
  const pagedVaults = vaults.slice(page * VAULTS_PER_PAGE, (page + 1) * VAULTS_PER_PAGE);

  const totalBalanceUsd = positions.reduce((sum, p) => {
    const assets = parseFloat(p.assetsFormatted);
    const price = parseFloat(p.vault.sharePrice.replace("$", "")) || 0;
    return sum + assets * price;
  }, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-earn-text-primary">Earn</h1>
        <p className="text-sm text-earn-text-secondary mt-1">
          Deposit into Morpho vaults and earn yield on your assets
        </p>
      </div>

      {/* Portfolio summary */}
      {isConnected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5" style={{ border: "1px solid #DADADA" }}>
            <p className="text-sm text-earn-text-secondary font-medium">Total balance</p>
            <p className="text-2xl font-semibold text-earn-text-primary mt-2">
              {positionsLoading ? "—" : `$${totalBalanceUsd.toFixed(2)}`}
            </p>
            <p className="text-xs text-earn-text-secondary mt-1">
              Across {positions.length} active vault{positions.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5" style={{ border: "1px solid #DADADA" }}>
            <p className="text-sm text-earn-text-secondary font-medium">Wallet</p>
            <p className="text-sm font-mono text-earn-text-primary mt-2 truncate">{address}</p>
            <p className="text-xs text-earn-text-secondary mt-1">
              {vaults.length} vaults available on this network
            </p>
          </div>
        </div>
      )}

      {/* Vaults grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-earn-text-primary">Vaults</h2>
            {vaults.length > 0 && (
              <p className="text-xs text-earn-text-secondary mt-0.5">
                {vaults.length} vaults · sorted by TVL
              </p>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg bg-white hover:bg-earn-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ border: "1px solid #DADADA" }}
              >
                <ChevronLeft className="h-4 w-4 text-earn-text-secondary" />
              </button>
              <span className="text-xs text-earn-text-secondary">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-1.5 rounded-lg bg-white hover:bg-earn-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ border: "1px solid #DADADA" }}
              >
                <ChevronRight className="h-4 w-4 text-earn-text-secondary" />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: VAULTS_PER_PAGE }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-earn-border shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-7 w-16 shrink-0" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
                <Skeleton className="h-8 mt-2" />
                <Skeleton className="h-9" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-sm text-red-600">
            Error loading vaults: {error}
          </div>
        ) : pagedVaults.length === 0 ? (
          <div className="p-6 bg-earn-light rounded-xl border border-earn-border text-sm text-earn-text-secondary text-center">
            No vaults available on this network.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagedVaults.map((vault) => (
              <VaultCard
                key={vault.id}
                vault={vault}
                assetBalance={assetBalances[vault.assetAddress?.toLowerCase() ?? ""] ?? "0"}
                onSuccess={() => setRefreshKey((k) => k + 1)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Your positions */}
      {isConnected && (
        <section>
          <h2 className="text-sm font-medium text-earn-text-primary mb-4">Your Positions</h2>
          {positionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-earn-border p-4 flex flex-col gap-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                  </div>
                </div>
              ))}
            </div>
          ) : positions.length === 0 ? (
            <div
              className="rounded-xl p-6 text-center"
              style={{ background: "#F9F9F9", border: "1px solid #DADADA" }}
            >
              <p className="text-sm text-earn-text-secondary">
                No active positions. Deposit into a vault above to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {positions.map((position) => (
                <PositionCard key={position.vault.id} position={position} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
