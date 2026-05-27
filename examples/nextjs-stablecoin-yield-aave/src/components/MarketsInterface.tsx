"use client";

import {
  chainId as aaveChainId,
  evmAddress,
  useAaveMarkets,
  useUserBorrows,
  useUserSupplies,
} from "@aave/react";
import { useEffect, useMemo, useState } from "react";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { mainnet, base, polygon } from "viem/chains";
import type { WalletClient } from "viem";
import type { EvmWalletAccount } from "@dynamic-labs-sdk/evm";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactionOperations } from "../lib/useTransactionOperations";
import { getChainName } from "../lib/utils";
import { BorrowCard } from "./BorrowCard";
import { MarketCard } from "./MarketCard";
import { SupplyCard } from "./SupplyCard";
import { useWallet } from "@/lib/providers";

const FEATURED_SYMBOLS = new Set(["PYUSD"]);

// urql (used inside @aave/react hooks) triggers a synchronous setState on its
// first render, which React 19 rejects in concurrent mode.  We work around this
// by deferring the mount of the inner component by one commit so its hooks
// always execute in their own render cycle.
export function MarketsInterface() {
  const { evmAccount, chainId, setChainId } = useWallet();
  const address = evmAccount?.address ?? "disconnected";
  const [refreshKey, setRefreshKey] = useState(0);
  const mountKey = `${chainId}-${address}-${refreshKey}`;

  const [activeKey, setActiveKey] = useState<string | null>(null);
  useEffect(() => {
    setActiveKey(mountKey);
  }, [mountKey]);

  if (activeKey !== mountKey) {
    return <MarketsSkeleton />;
  }

  return (
    <MarketsInterfaceInner
      key={mountKey}
      chainId={chainId}
      onChainChange={setChainId}
      onRefresh={() => setRefreshKey((k) => k + 1)}
    />
  );
}

function MarketsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="bg-white border border-earn-border rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-28" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-28" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketsInterfaceInner({
  chainId,
  onChainChange,
  onRefresh,
}: Readonly<{
  chainId: number;
  onChainChange: (id: number) => void;
  onRefresh: () => void;
}>) {
  const { evmAccount } = useWallet();
  const [txError, setTxError] = useState<string | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  useEffect(() => {
    if (!evmAccount) {
      setWalletClient(null);
      setWalletChainId(null);
      return;
    }
    let cancelled = false;
    createWalletClientForWalletAccount({ walletAccount: evmAccount })
      .then((client) => {
        if (cancelled) return;
        setWalletClient(client);
        if (client.chain?.id) setWalletChainId(client.chain.id);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Wallet client creation failed:", err);
        setWalletClient(null);
      });
    return () => {
      cancelled = true;
    };
  }, [evmAccount, chainId]);

  const {
    isOperating,
    executeSupply,
    executeBorrow,
    executeRepay,
    executeWithdraw,
  } = useTransactionOperations(walletClient, chainId);

  const userAddress = useMemo(
    () => (evmAccount?.address ? evmAddress(evmAccount.address) : undefined),
    [evmAccount?.address],
  );

  const {
    data: markets,
    loading: marketsLoading,
    error: marketsError,
  } = useAaveMarkets({
    chainIds: [aaveChainId(chainId)],
    user: userAddress,
  });

  const marketRefs = useMemo(
    () =>
      markets?.map((m) => ({ chainId: m.chain.chainId, address: m.address })) ??
      [],
    [markets],
  );

  const {
    data: userSupplies,
    loading: userSuppliesLoading,
    error: userSuppliesError,
  } = useUserSupplies({ markets: marketRefs, user: userAddress });

  const {
    data: userBorrows,
    loading: userBorrowsLoading,
    error: userBorrowsError,
  } = useUserBorrows({ markets: marketRefs, user: userAddress });

  const friendlyError = (action: string, error: unknown): string => {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("execution reverted"))
      return action === "Borrow"
        ? "Borrow reverted — you may not have enough collateral. Supply assets first, then try again."
        : `${action} reverted — check your balance and collateral, then try again.`;
    if (msg.includes("User rejected") || msg.includes("user rejected"))
      return `${action} was cancelled.`;
    return `${action} failed: ${msg}`;
  };

  const wrap =
    (action: string, fn: (...args: string[]) => Promise<unknown>) =>
    async (...args: string[]) => {
      setTxError(null);
      try {
        await fn(...args);
        onRefresh();
      } catch (error) {
        setTxError(friendlyError(action, error));
      }
    };

  const handleSupply = wrap("Supply", executeSupply);
  const handleBorrow = wrap("Borrow", executeBorrow);
  const handleRepay = wrap("Repay", executeRepay);
  const handleWithdraw = wrap("Withdraw", executeWithdraw);

  const sortedMarkets = (markets ?? []).slice().sort((a, b) => {
    const aFeatured = a.supplyReserves.some((r) =>
      FEATURED_SYMBOLS.has(r.underlyingToken.symbol),
    );
    const bFeatured = b.supplyReserves.some((r) =>
      FEATURED_SYMBOLS.has(r.underlyingToken.symbol),
    );
    if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
    return 0;
  });

  const primaryWallet = evmAccount ? { address: evmAccount.address } : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-earn-text-primary">
          Aave Markets
        </h1>
        <p className="text-sm text-earn-text-secondary mt-1">
          Supply assets and borrow against your collateral on{" "}
          {getChainName(chainId)}
        </p>
      </div>

      {txError && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          <p className="text-sm text-destructive flex-1">{txError}</p>
          <button
            onClick={() => setTxError(null)}
            className="cursor-pointer text-destructive/60 hover:text-destructive text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {evmAccount && walletChainId !== null && walletChainId !== chainId && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800">
            Wallet is on {getChainName(walletChainId)}. Switch in the network
            menu.
          </p>
        </div>
      )}

      <MarketsSection
        loading={marketsLoading}
        error={marketsError}
        markets={sortedMarkets}
        chainId={chainId}
        isOperating={isOperating}
        primaryWallet={primaryWallet}
        onChainChange={onChainChange}
        onSupply={handleSupply}
        onBorrow={handleBorrow}
      />

      {evmAccount && (
        <>
          <SuppliesSection
            loading={userSuppliesLoading}
            error={userSuppliesError}
            supplies={userSupplies ?? null}
            isOperating={isOperating}
            evmAccount={evmAccount}
            onSupply={handleSupply}
            onBorrow={handleBorrow}
            onWithdraw={handleWithdraw}
          />
          <BorrowsSection
            loading={userBorrowsLoading}
            error={userBorrowsError}
            borrows={userBorrows ?? null}
            isOperating={isOperating}
            evmAccount={evmAccount}
            onRepay={handleRepay}
          />
        </>
      )}
    </div>
  );
}

type Market = NonNullable<ReturnType<typeof useAaveMarkets>["data"]>[number];
type UserSupply = NonNullable<
  ReturnType<typeof useUserSupplies>["data"]
>[number];
type UserBorrow = NonNullable<
  ReturnType<typeof useUserBorrows>["data"]
>[number];

function MarketsSection({
  loading,
  error,
  markets,
  chainId,
  isOperating,
  primaryWallet,
  onChainChange,
  onSupply,
  onBorrow,
}: Readonly<{
  loading: boolean;
  error: unknown;
  markets: Market[];
  chainId: number;
  isOperating: boolean;
  primaryWallet: { address: string } | null;
  onChainChange: (id: number) => void;
  onSupply: (...args: string[]) => void;
  onBorrow: (...args: string[]) => void;
}>) {
  if (loading) return <MarketCardSkeletons count={2} cols="md:grid-cols-2" />;
  if (error)
    return <ErrorBox message={`Error loading markets: ${String(error)}`} />;
  if (markets.length > 0) {
    return (
      <section>
        <SectionHeading>Available Markets</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {markets.map((market) => (
            <MarketCard
              key={market.address}
              market={market}
              isOperating={isOperating}
              primaryWallet={primaryWallet}
              onSupply={onSupply}
              onBorrow={onBorrow}
            />
          ))}
        </div>
      </section>
    );
  }
  return (
    <section>
      <SectionHeading>Available Markets</SectionHeading>
      <div className="bg-white border border-earn-border rounded-xl p-6 space-y-4">
        <p className="text-earn-text-secondary text-sm">
          No markets found for {getChainName(chainId)}.
        </p>
        <div className="space-y-2">
          <p className="text-xs text-earn-text-secondary">
            Try switching to a supported network:
          </p>
          <div className="flex flex-wrap gap-2">
            {[mainnet, base, polygon].map((chain) => (
              <Button
                key={chain.id}
                variant="outline"
                size="sm"
                onClick={() => onChainChange(chain.id)}
                disabled={chainId === chain.id}
                className="border-earn-border text-earn-text-primary hover:bg-earn-light"
              >
                {chain.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SuppliesSection({
  loading,
  error,
  supplies,
  isOperating,
  evmAccount,
  onSupply,
  onBorrow,
  onWithdraw,
}: Readonly<{
  loading: boolean;
  error: unknown;
  supplies: UserSupply[] | null;
  isOperating: boolean;
  evmAccount: EvmWalletAccount;
  onSupply: (...args: string[]) => void;
  onBorrow: (...args: string[]) => void;
  onWithdraw: (...args: string[]) => void;
}>) {
  return (
    <section>
      <SectionHeading>Your Supplies</SectionHeading>
      {loading ? (
        <MarketCardSkeletons count={2} cols="md:grid-cols-2" compact />
      ) : error ? (
        <ErrorBox message={`Error loading supplies: ${String(error)}`} />
      ) : supplies && supplies.length > 0 ? (
        <div
          className={`grid grid-cols-1 gap-4 ${supplies.length >= 2 ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}
        >
          {supplies.map((supply) => (
            <SupplyCard
              key={`${supply.market.address}-${supply.currency.address}`}
              supply={supply}
              isOperating={isOperating}
              primaryWallet={{ address: evmAccount.address }}
              onSupply={onSupply}
              onBorrow={onBorrow}
              onWithdraw={onWithdraw}
            />
          ))}
        </div>
      ) : (
        <EmptyBox message="No active supplies." />
      )}
    </section>
  );
}

function BorrowsSection({
  loading,
  error,
  borrows,
  isOperating,
  evmAccount,
  onRepay,
}: Readonly<{
  loading: boolean;
  error: unknown;
  borrows: UserBorrow[] | null;
  isOperating: boolean;
  evmAccount: EvmWalletAccount;
  onRepay: (...args: string[]) => void;
}>) {
  return (
    <section className="pb-8">
      <SectionHeading>Your Borrows</SectionHeading>
      {loading ? (
        <MarketCardSkeletons
          count={2}
          cols="md:grid-cols-2 lg:grid-cols-3"
          compact
        />
      ) : error ? (
        <ErrorBox message={`Error loading borrows: ${String(error)}`} />
      ) : borrows && borrows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {borrows.map((borrow) => (
            <BorrowCard
              key={`${borrow.market.address}-${borrow.currency.address}`}
              borrow={borrow}
              isOperating={isOperating}
              primaryWallet={{ address: evmAccount.address }}
              onRepay={onRepay}
            />
          ))}
        </div>
      ) : (
        <EmptyBox message="No active borrows." />
      )}
    </section>
  );
}

function SectionHeading({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <h2 className="text-sm font-semibold text-earn-text-secondary uppercase tracking-wide mb-3">
      {children}
    </h2>
  );
}

function ErrorBox({ message }: Readonly<{ message: string }>) {
  return (
    <div className="bg-white border border-earn-border rounded-xl p-6">
      <p className="text-destructive text-sm">{message}</p>
    </div>
  );
}

function EmptyBox({ message }: Readonly<{ message: string }>) {
  return (
    <div className="bg-white border border-earn-border rounded-xl p-6">
      <p className="text-earn-text-secondary text-sm">{message}</p>
    </div>
  );
}

function MarketCardSkeletons({
  count,
  cols,
  compact = false,
}: Readonly<{ count: number; cols: string; compact?: boolean }>) {
  return (
    <div className={`grid grid-cols-1 ${cols} gap-4`}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="bg-white border border-earn-border rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-28" />
            </div>
            {!compact && (
              <>
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-12" />
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
