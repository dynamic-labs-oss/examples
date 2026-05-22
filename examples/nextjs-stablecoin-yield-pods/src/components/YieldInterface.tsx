"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactionOperations } from "../lib/useTransactionOperations";
import { getChainName } from "../lib/utils";
import { getBalances } from "@dynamic-labs-sdk/client";
import { dynamicClient } from "../lib/dynamic";
import { client as podsClient } from "../lib/pods";
import { useWallet } from "@/lib/providers";
import type { Strategy, Position, WalletPositions } from "../lib/pods-types";

// ─── helpers ─────────────────────────────────────────────────────────────────

interface AssetInfo {
  balance: string;
  symbol: string;
}

function formatApy(apy: number | undefined) {
  if (apy == null) return null;
  return `${(apy * 100).toFixed(2)}%`;
}

function ProtocolBadge({ name }: { name: string }) {
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: "#E8F0FE", color: "#1967D2" }}
    >
      {name}
    </span>
  );
}

function TokenLogo({
  url,
  symbol,
  size = 36,
}: {
  url?: string;
  symbol: string;
  size?: number;
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt={symbol}
        width={size}
        height={size}
        className="rounded-full shrink-0"
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ width: size, height: size, background: "#4779FF" }}
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-earn-light rounded-lg px-3 py-2">
      <p className="text-[10px] font-medium text-earn-text-secondary uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm font-semibold text-earn-text-primary mt-0.5">
        {value}
      </p>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-earn-border p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-6 w-12" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
      <Skeleton className="h-9 rounded-lg" />
    </div>
  );
}

function PositionSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-earn-border p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-6 w-14" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
      <Skeleton className="h-9 rounded-lg" />
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function YieldInterface() {
  const { evmAccount, loggedIn, chainId } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<WalletPositions | null>(null);
  const [positionsLoading, setPositionsLoading] = useState(false);
  // stores { balance, symbol } keyed by underlying asset address
  const [assetInfoMap, setAssetInfoMap] = useState<Record<string, AssetInfo>>(
    {},
  );

  useEffect(() => { setMounted(true); }, []);

  const fetchStrategies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await podsClient.getStrategies(chainId, 100);
      setStrategies(res.data.filter((s) => s.isActive !== false));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  useEffect(() => {
    if (!loggedIn || !evmAccount?.address) {
      setPositions(null);
      return;
    }
    setPositionsLoading(true);
    podsClient
      .getWalletPositions(evmAccount.address)
      .then(setPositions)
      .catch(() => setPositions(null))
      .finally(() => setPositionsLoading(false));
  }, [loggedIn, evmAccount?.address, refreshKey]);

  const assetAddresses = useMemo(
    () => [
      ...new Set(strategies.map((s) => s.underlyingAsset).filter(Boolean)),
    ],
    [strategies],
  );

  useEffect(() => {
    if (!evmAccount || assetAddresses.length === 0) return;
    getBalances(
      {
        walletAccount: evmAccount,
        networkId: chainId,
        whitelistedContracts: assetAddresses,
        filterSpamTokens: true,
      },
      dynamicClient,
    )
      .then((bals) => {
        const map: Record<string, AssetInfo> = {};
        for (const b of bals) {
          if (b.address)
            map[b.address.toLowerCase()] = {
              balance: b.balance,
              symbol: b.symbol ?? "",
            };
        }
        setAssetInfoMap(map);
      })
      .catch(() => {});
  }, [evmAccount, chainId, assetAddresses, refreshKey]);

  useEffect(() => {
    if (!lastTxHash) return;
    const t = setTimeout(() => setLastTxHash(null), 4000);
    return () => clearTimeout(t);
  }, [lastTxHash]);

  const { isOperating, executeDeposit, executeWithdraw } =
    useTransactionOperations(null, chainId);
  const onSuccess = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleDeposit = useCallback(
    async (strategy: Strategy, amount: string) => {
      const hash = await executeDeposit(strategy, amount);
      if (hash) {
        setLastTxHash(hash);
        onSuccess();
        fetchStrategies();
      }
    },
    [executeDeposit, onSuccess, fetchStrategies],
  );

  const handleWithdraw = useCallback(
    async (strategy: Strategy, amount: string) => {
      const hash = await executeWithdraw(strategy, amount);
      if (hash) {
        setLastTxHash(hash);
        onSuccess();
        fetchStrategies();
      }
    },
    [executeWithdraw, onSuccess, fetchStrategies],
  );

  const handlePositionWithdraw = useCallback(
    async (position: Position, amount: string) => {
      let strategy: Strategy | null = position.strategyId
        ? await podsClient.getStrategy(position.strategyId).catch(() => null)
        : null;
      if (!strategy) {
        strategy = {
          asset: position.asset.address,
          protocol: position.protocol,
          assetName: position.asset.symbol,
          network: "",
          networkId: "",
          implementationSelector: position.protocol,
          startDate: "",
          underlyingAsset: position.asset.address,
          assetDecimals: parseInt(position.asset.decimals),
          underlyingDecimals: parseInt(position.asset.decimals),
          id: `${position.protocol}-${position.asset.symbol}`,
          fee: "0",
        };
      }
      await handleWithdraw(strategy, amount);
    },
    [handleWithdraw],
  );

  const activePositions = positions?.positions ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-earn-text-primary">
          Yield Strategies
        </h1>
        <p className="text-sm text-earn-text-secondary mt-1">
          Deposit into yield strategies on {getChainName(chainId)} · powered by
          Deframe Pods
        </p>
      </div>

      {lastTxHash && (
        <div className="p-4 rounded-xl border border-green-200 bg-green-50 text-sm text-green-700 flex items-center justify-between">
          <span>Transaction sent!</span>
          <span className="font-mono text-xs">{lastTxHash.slice(0, 10)}…</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="cursor-pointer text-red-400 hover:text-red-600 text-lg"
          >
            &times;
          </button>
        </div>
      )}

      {/* Always-visible Positions section */}
      {mounted && loggedIn && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-earn-text-secondary uppercase tracking-wide">
              Your Positions
            </h2>
            <button
              onClick={onSuccess}
              disabled={positionsLoading}
              className="cursor-pointer text-xs text-earn-primary hover:underline disabled:opacity-40"
            >
              {positionsLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {positionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <PositionSkeleton />
              <PositionSkeleton />
            </div>
          ) : activePositions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePositions.map((position, idx) => (
                <PositionCard
                  key={idx}
                  position={position}
                  isOperating={isOperating}
                  onWithdraw={handlePositionWithdraw}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-earn-border rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-earn-text-primary font-medium">
                  No positions yet
                </p>
                <p className="text-xs text-earn-text-secondary mt-0.5">
                  New deposits may take a few minutes to appear. Hit Refresh to
                  check again.
                </p>
              </div>
              <button
                onClick={onSuccess}
                disabled={positionsLoading}
                className="cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-earn-light disabled:opacity-40"
                style={{ borderColor: "#DADADA", color: "#4779FF" }}
              >
                Refresh
              </button>
            </div>
          )}
        </section>
      )}

      {/* Strategies */}
      <section>
        <h2 className="text-sm font-semibold text-earn-text-secondary uppercase tracking-wide mb-3">
          Available Strategies
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : strategies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((strategy) => {
              const info =
                assetInfoMap[strategy.underlyingAsset?.toLowerCase() ?? ""];
              return (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  isOperating={isOperating}
                  primaryWallet={
                    evmAccount ? { address: evmAccount.address } : null
                  }
                  assetInfo={
                    info ?? { balance: "0", symbol: strategy.assetName }
                  }
                  onDeposit={handleDeposit}
                />
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-earn-border rounded-xl p-8 text-center">
            <p className="text-sm text-earn-text-secondary">
              No strategies on {getChainName(chainId)}.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── PositionCard ─────────────────────────────────────────────────────────────

interface PositionCardProps {
  position: Position;
  isOperating: boolean;
  onWithdraw: (position: Position, amount: string) => void;
}

function PositionCard({
  position,
  isOperating,
  onWithdraw,
}: PositionCardProps) {
  const [amount, setAmount] = useState("");
  const maxAmount = position.balance.humanized;
  const apyRaw = parseFloat(position.apy);
  // API returns APY as a percentage (e.g., 5.25 means 5.25%) not a fraction
  const apyFormatted =
    isFinite(apyRaw) && apyRaw > 0 ? `${apyRaw.toFixed(2)}%` : "—";

  return (
    <Card className="bg-white border border-earn-border rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-earn-border">
        <div className="flex items-center gap-3">
          <TokenLogo symbol={position.asset.symbol} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-earn-text-primary">
                {position.asset.symbol}
              </h3>
              {position.protocol && <ProtocolBadge name={position.protocol} />}
            </div>
            <p className="text-xs text-earn-text-secondary mt-0.5">
              {position.asset.name}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-earn-primary">
              {apyFormatted}
            </p>
            <p className="text-[10px] text-earn-text-secondary">APY</p>
          </div>
        </div>
      </div>
      <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-earn-light rounded-lg px-3 py-2">
            <p className="text-[10px] font-medium text-earn-text-secondary uppercase tracking-wide">
              Balance
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <TokenLogo symbol={position.asset.symbol} size={16} />
              <p className="text-sm font-semibold text-earn-text-primary">
                {maxAmount.toFixed(4)} {position.asset.symbol}
              </p>
            </div>
          </div>
          <StatBox
            label="USD Value"
            value={`$${parseFloat(position.balanceUSD).toFixed(2)}`}
          />
          {parseFloat(position.earnedUSD) > 0 && (
            <StatBox
              label="Earned"
              value={`$${parseFloat(position.earnedUSD).toFixed(4)}`}
            />
          )}
        </div>

        <div className="flex gap-2 mt-auto pt-1">
          <div className="relative flex-1">
            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-xs px-3 py-2 pr-10 border border-earn-border rounded-lg outline-none focus:ring-2 focus:ring-earn-primary/30 bg-white"
              disabled={isOperating}
            />
            <button
              type="button"
              onClick={() => setAmount(String(maxAmount))}
              className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-earn-primary hover:text-earn-primary/80"
            >
              Max
            </button>
          </div>
          <button
            onClick={() => {
              if (!amount || parseFloat(amount) <= 0) return;
              onWithdraw(position, amount);
              setAmount("");
            }}
            disabled={
              isOperating ||
              !amount ||
              parseFloat(amount) <= 0 ||
              parseFloat(amount) > maxAmount
            }
            className="cursor-pointer px-3 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: "#DADADA", color: "#606060" }}
          >
            Withdraw
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── StrategyCard ─────────────────────────────────────────────────────────────

interface StrategyCardProps {
  strategy: Strategy;
  isOperating: boolean;
  primaryWallet: { address: string } | null;
  assetInfo: AssetInfo;
  onDeposit: (strategy: Strategy, amount: string) => void;
}

function StrategyCard({
  strategy,
  isOperating,
  primaryWallet,
  assetInfo,
  onDeposit,
}: StrategyCardProps) {
  const [amount, setAmount] = useState("");
  const apy = formatApy(strategy.spotPosition?.apy);
  const avgApy = formatApy(strategy.spotPosition?.avgApy);
  const description =
    strategy.metadata?.EN?.description ?? strategy.metadata?.PT?.description;
  const feeLabel =
    strategy.fee && strategy.fee !== "0"
      ? `${(parseFloat(strategy.fee) * 100).toFixed(2)}%`
      : "None";
  const hasBalance = Number(assetInfo.balance) > 0;
  const balanceDisplay = `${Number(assetInfo.balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${assetInfo.symbol}`;

  return (
    <Card className="bg-white border border-earn-border rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-earn-border">
        <div className="flex items-center gap-3">
          <TokenLogo
            url={strategy.logourl}
            symbol={assetInfo.symbol || strategy.assetName}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-earn-text-primary">
                {strategy.assetName}
              </h3>
              {strategy.protocol && <ProtocolBadge name={strategy.protocol} />}
            </div>
            {description && (
              <p className="text-xs text-earn-text-secondary mt-0.5 line-clamp-1">
                {description}
              </p>
            )}
          </div>
          {apy && (
            <div className="text-right shrink-0">
              <p className="text-base font-bold text-earn-primary">{apy}</p>
              <p className="text-[10px] text-earn-text-secondary">APY</p>
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <div className="grid grid-cols-2 gap-2">
          {/* Wallet balance with token logo */}
          <div className="bg-earn-light rounded-lg px-3 py-2">
            <p className="text-[10px] font-medium text-earn-text-secondary uppercase tracking-wide">
              Wallet Balance
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <TokenLogo
                url={strategy.logourl}
                symbol={assetInfo.symbol || strategy.assetName}
                size={16}
              />
              <p className="text-sm font-semibold text-earn-text-primary">
                {primaryWallet ? balanceDisplay : "—"}
              </p>
            </div>
          </div>

          <StatBox label="Fee" value={feeLabel} />

          {avgApy && <StatBox label="Avg APY" value={avgApy} />}
          {strategy.spotPosition?.inceptionApy != null && (
            <StatBox
              label="Inception APY"
              value={`${(strategy.spotPosition.inceptionApy * 100).toFixed(2)}%`}
            />
          )}
        </div>

        <div className="flex gap-2 mt-auto">
          <div className="relative flex-1">
            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-xs px-3 py-2 pr-10 border border-earn-border rounded-lg outline-none focus:ring-2 focus:ring-earn-primary/30 bg-white"
              disabled={isOperating || !primaryWallet}
            />
            {primaryWallet && hasBalance && (
              <button
                type="button"
                onClick={() => setAmount(assetInfo.balance)}
                className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-earn-primary hover:text-earn-primary/80"
              >
                Max
              </button>
            )}
          </div>
          <button
            onClick={() => {
              if (!amount || parseFloat(amount) <= 0) return;
              onDeposit(strategy, amount);
              setAmount("");
            }}
            disabled={
              isOperating ||
              !primaryWallet ||
              !amount ||
              parseFloat(amount) <= 0
            }
            className="cursor-pointer px-4 py-2 text-xs font-medium rounded-lg text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#4779FF" }}
          >
            Deposit
          </button>
        </div>

        {!primaryWallet && (
          <p className="text-xs text-earn-text-secondary text-center">
            Sign in to deposit
          </p>
        )}
      </CardContent>
    </Card>
  );
}
