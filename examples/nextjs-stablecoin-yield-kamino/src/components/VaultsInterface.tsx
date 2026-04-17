"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchVaults, fetchVaultMetrics, fetchUserPositions } from "@/lib/kamino";
import { useVaultOperations } from "@/lib/useVaultOperations";
import { useWallet } from "@/lib/providers";
import { getTokenInfo, formatUSD, shortenAddress } from "@/lib/utils";
import type { EnrichedVault, UserPosition, LastTransaction } from "@/lib/types";

import { VaultCard } from "./VaultCard";
import { PositionCard } from "./PositionCard";
import { CheckCircle, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

const VAULTS_PER_PAGE = 6;

export function VaultsInterface() {
  const { solanaAccount, loggedIn } = useWallet();
  const { isOperating, operationError, executeDeposit, executeWithdraw } =
    useVaultOperations();
  const queryClient = useQueryClient();

  const [lastTransaction, setLastTransaction] = useState<LastTransaction | null>(null);
  const [page, setPage] = useState(0);

  // Fetch all vaults (pre-sorted by AUM in kamino.ts)
  const { data: rawVaults = [], isLoading: vaultsLoading, error: vaultsError } =
    useQuery({
      queryKey: ["kamino-vaults"],
      queryFn: fetchVaults,
      staleTime: 1000 * 60 * 5,
    });

  const totalPages = Math.ceil(rawVaults.length / VAULTS_PER_PAGE);
  const pagedVaults = rawVaults.slice(
    page * VAULTS_PER_PAGE,
    (page + 1) * VAULTS_PER_PAGE
  );

  // Fetch metrics for current page only
  const { data: metricsMap = {} } = useQuery({
    queryKey: ["kamino-vault-metrics", pagedVaults.map((v) => v.address)],
    queryFn: async () => {
      const entries = await Promise.allSettled(
        pagedVaults.map(async (v) => {
          const metrics = await fetchVaultMetrics(v.address);
          return [v.address, metrics] as const;
        })
      );
      return Object.fromEntries(
        entries
          .filter((r) => r.status === "fulfilled")
          .map((r) => (r as PromiseFulfilledResult<readonly [string, unknown]>).value)
      );
    },
    enabled: pagedVaults.length > 0,
    staleTime: 1000 * 30,
  });

  // Enrich with token info and metrics, then sort loaded page by TVL desc
  const enrichedVaults: EnrichedVault[] = useMemo(() => {
    const enriched = pagedVaults.map((vault) => {
      const tokenInfo = getTokenInfo(vault.state.tokenMint);
      return {
        ...vault,
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        decimals: vault.state.tokenMintDecimals ?? tokenInfo.decimals,
        metrics: (metricsMap as Record<string, EnrichedVault["metrics"]>)[vault.address] ?? null,
      };
    });

    // Re-sort by TVL once metrics are available
    const allHaveMetrics = enriched.every((v) => v.metrics !== null);
    if (allHaveMetrics) {
      enriched.sort((a, b) => (b.metrics?.tvlUsd ?? 0) - (a.metrics?.tvlUsd ?? 0));
    }
    return enriched;
  }, [pagedVaults, metricsMap]);

  // Fetch user positions
  const {
    data: userPositions = [],
    isLoading: positionsLoading,
    refetch: refetchPositions,
  } = useQuery({
    queryKey: ["kamino-positions", solanaAccount?.address],
    queryFn: () => fetchUserPositions(solanaAccount!.address),
    enabled: !!solanaAccount?.address,
    staleTime: 1000 * 60,
  });

  // Auto-clear success toast
  useEffect(() => {
    if (!lastTransaction) return;
    const timer = setTimeout(() => setLastTransaction(null), 12000);
    return () => clearTimeout(timer);
  }, [lastTransaction]);

  const refreshAfterAction = () => {
    // Transactions are confirmed before returning, so refetch immediately.
    // Kamino's API can take 5–15s to index a new position, so retry several
    // times rather than relying on a single fixed delay.
    refetchPositions();
    queryClient.invalidateQueries({ queryKey: ["kamino-vault-metrics"] });
    for (const delay of [3000, 7000, 12000, 20000]) {
      setTimeout(() => refetchPositions(), delay);
    }
  };

  const handleDeposit = async (vaultAddress: string, amount: number, tokenMint: string): Promise<boolean> => {
    try {
      const hash = await executeDeposit(vaultAddress, amount, tokenMint);
      if (hash) {
        setLastTransaction({ type: "Deposit", hash, timestamp: Date.now() });
        refreshAfterAction();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleWithdraw = async (vaultAddress: string, shares: number): Promise<boolean> => {
    try {
      const hash = await executeWithdraw(vaultAddress, shares);
      if (hash) {
        setLastTransaction({ type: "Withdraw", hash, timestamp: Date.now() });
        refreshAfterAction();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Enrich positions: compute tokenBalance/usdValue from the share ratio when
  // the API returns zeros. totalShares is decimal-adjusted; sharesIssued is raw,
  // so divide by 10^sharesMintDecimals before computing the ratio.
  const enrichedPositions: UserPosition[] = (userPositions as UserPosition[]).map((pos) => {
    const vault = enrichedVaults.find((v) => v.address === pos.vaultAddress);
    const m = vault?.metrics ?? null;
    const sharesIssuedRaw = parseFloat(vault?.state.sharesIssued ?? "0");
    const shareDecimals = vault?.state.sharesMintDecimals ?? 6;
    const sharesIssuedDecimal = sharesIssuedRaw / Math.pow(10, shareDecimals);

    if (sharesIssuedDecimal > 0 && m) {
      const shareRatio = parseFloat(pos.shares) / sharesIssuedDecimal;
      const usdValue = pos.usdValue > 0 ? pos.usdValue : shareRatio * (m.tvlUsd ?? 0);
      const tokenBalance = pos.tokenBalance > 0 ? pos.tokenBalance : (m.tokenPrice > 0 ? usdValue / m.tokenPrice : 0);
      return { ...pos, usdValue, tokenBalance };
    }
    return pos;
  });

  const positionsByVault: Record<string, UserPosition> = {};
  for (const pos of enrichedPositions) {
    positionsByVault[pos.vaultAddress] = pos;
  }

  const positionsWithVaults = enrichedPositions.map((pos) => ({
    position: pos,
    vault: enrichedVaults.find((v) => v.address === pos.vaultAddress),
  }));

  // Aggregate portfolio value
  const totalPortfolioUsd = enrichedPositions.reduce(
    (sum, p) => sum + (p.usdValue || 0),
    0
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* ── Page header ─────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-medium text-[#030303]">Kamino Earn</h1>
        <p className="text-sm text-[#606060] mt-1">
          Deposit into Kamino Earn vaults on Solana and earn yield automatically
        </p>
      </div>

      {/* ── Portfolio summary (logged-in) ────────────────────── */}
      {loggedIn && solanaAccount && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5" style={{ border: "1px solid #DADADA" }}>
            <p className="text-sm text-[#606060] font-medium">Total balance</p>
            <p className="text-2xl font-medium text-[#030303] mt-2">
              {totalPortfolioUsd > 0 ? formatUSD(totalPortfolioUsd) : "$0.00"}
            </p>
            <p className="text-xs text-[#606060] mt-1">
              Across {(userPositions as UserPosition[]).length} active vault{(userPositions as UserPosition[]).length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5" style={{ border: "1px solid #DADADA" }}>
            <p className="text-sm text-[#606060] font-medium">Wallet</p>
            <p className="text-sm font-mono text-[#030303] mt-2 truncate">{solanaAccount.address}</p>
            <a
              href={`https://solscan.io/account/${solanaAccount.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs mt-1 hover:underline"
              style={{ color: "#4779FF" }}
            >
              View on Solscan <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* ── Transaction toast ────────────────────────────────── */}
      {lastTransaction && (
        <div
          className="flex items-center gap-3 p-3 rounded-xl text-sm"
          style={{ background: "#E8F0FE", border: "1px solid #4779FF33" }}
        >
          <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "#1967D2" }} />
          <span className="font-medium flex-1" style={{ color: "#1967D2" }}>
            {lastTransaction.type} successful
          </span>
          <a
            href={`https://solscan.io/tx/${lastTransaction.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs hover:underline"
            style={{ color: "#1967D2" }}
          >
            {shortenAddress(lastTransaction.hash)} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* ── Error toast ──────────────────────────────────────── */}
      {operationError && (
        <div className="p-3 rounded-xl text-sm text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          {operationError}
        </div>
      )}

      {/* ── Vaults grid ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-medium text-[#030303]">Earn Vaults</h2>
            {rawVaults.length > 0 && (
              <p className="text-xs text-[#606060] mt-0.5">
                {rawVaults.length} vaults · sorted by liquidity
              </p>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-[#DADADA] bg-white hover:bg-[#F9F9F9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-[#606060]" />
              </button>
              <span className="text-xs text-[#606060]">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-1.5 rounded-lg border border-[#DADADA] bg-white hover:bg-[#F9F9F9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-[#606060]" />
              </button>
            </div>
          )}
        </div>

        {vaultsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-white border border-[#DADADA] animate-pulse" />
            ))}
          </div>
        ) : vaultsError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
            Failed to load vaults. Please try again.
          </p>
        ) : enrichedVaults.length === 0 ? (
          <p className="text-sm text-[#606060]">No vaults found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrichedVaults.map((vault) => (
              <VaultCard
                key={vault.address}
                vault={vault}
                position={positionsByVault[vault.address]}
                isOperating={isOperating}
                primaryWallet={loggedIn && solanaAccount ? { address: solanaAccount.address } : null}
                onDeposit={handleDeposit}
                onWithdraw={handleWithdraw}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Your positions ───────────────────────────────────── */}
      {loggedIn && solanaAccount && (
        <section>
          <h2 className="text-base font-medium text-[#030303] mb-4">Your Positions</h2>
          {positionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-36 rounded-xl bg-white border border-[#DADADA] animate-pulse" />
              ))}
            </div>
          ) : positionsWithVaults.length === 0 ? (
            <div
              className="rounded-xl p-6 text-center"
              style={{ background: "#F9F9F9", border: "1px solid #DADADA" }}
            >
              <p className="text-sm text-[#606060]">
                No active positions yet. Deposit into a vault above to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {positionsWithVaults.map(({ position, vault }) => (
                <PositionCard
                  key={position.vaultAddress}
                  position={position}
                  vault={vault}
                  isOperating={isOperating}
                  onWithdraw={handleWithdraw}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
