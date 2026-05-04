"use client";

import { useEffect, useState, useCallback } from "react";
import { mainnet, base, polygon } from "viem/chains";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTransactionOperations } from "../lib/useTransactionOperations";
import { getChainName } from "../lib/utils";
import { client as podsClient } from "../lib/pods";
import { useWallet } from "@/lib/providers";
import type {
  Strategy,
  WalletPositions,
  Position,
  PositionCardProps,
  StrategyCardProps,
} from "../lib/pods-types";

export function YieldInterface() {
  const { evmAccount, loggedIn } = useWallet();
  const [selectedChainId, setSelectedChainId] = useState<number>(base.id);
  const [isSwitching, setIsSwitching] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastTransaction, setLastTransaction] = useState<{
    type: string;
    hash: string;
    timestamp: number;
  } | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<WalletPositions | null>(null);

  // Use selectedChainId as the active chain
  const chainId = selectedChainId;

  const fetchStrategies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await podsClient.getStrategies(chainId, 100);
      const activeStrategies = response.data.filter(
        (s) => s.isActive !== false
      );
      setStrategies(activeStrategies);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  // Fetch positions when wallet is connected
  useEffect(() => {
    const fetchPositions = async () => {
      if (!evmAccount?.address) {
        setPositions(null);
        return;
      }

      try {
        const data = await podsClient.getWalletPositions(evmAccount.address);
        setPositions(data);
      } catch (err) {
        console.error("Failed to fetch positions:", err);
        setPositions(null);
      }
    };

    fetchPositions();
  }, [evmAccount?.address]);

  const handleSwitchChain = async (targetChainId: number) => {
    setIsSwitching(true);
    setChainError(null);
    try {
      setSelectedChainId(targetChainId);
    } catch {
      setChainError("Failed to switch chain. Please try again.");
    } finally {
      setIsSwitching(false);
    }
  };

  useEffect(() => {
    if (lastTransaction) {
      const timer = setTimeout(() => {
        setLastTransaction(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [lastTransaction]);

  const { isOperating, executeDeposit, executeWithdraw } =
    useTransactionOperations(null, chainId);

  const handleDeposit = async (strategy: Strategy, amount: string) => {
    try {
      const hash = await executeDeposit(strategy, amount);
      if (hash) {
        setLastTransaction({
          type: "Deposit",
          hash,
          timestamp: Date.now(),
        });
        await fetchStrategies();
      }
    } catch (error) {
      console.error("Deposit failed:", error);
      setError(error instanceof Error ? error.message : "Deposit failed");
    }
  };

  const handleWithdraw = async (strategy: Strategy, amount: string) => {
    try {
      const hash = await executeWithdraw(strategy, amount);
      if (hash) {
        setLastTransaction({
          type: "Withdraw",
          hash,
          timestamp: Date.now(),
        });
        await fetchStrategies();
        if (evmAccount?.address) {
          const data = await podsClient.getWalletPositions(evmAccount.address);
          setPositions(data);
        }
      }
    } catch (error) {
      console.error("Withdraw failed:", error);
      setError(error instanceof Error ? error.message : "Withdraw failed");
    }
  };

  const handlePositionWithdraw = async (position: Position, amount: string) => {
    try {
      let strategy: Strategy | null = null;
      if (position.strategyId) {
        strategy = await podsClient.getStrategy(position.strategyId);
      }

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
    } catch (e) {
      console.error("Failed to resolve strategy for withdraw", e);
      throw e;
    }
  };

  if (isSwitching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <p className="text-center text-[#606060]">
              Switching to {getChainName(chainId)}...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div key={`yield-${chainId}-${refreshKey}`} className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#030303]">
          Yield Strategies
        </h1>
        <p className="text-sm text-[#606060] mt-1">
          Deposit stablecoins into yield strategies powered by Deframe Pods
        </p>
      </div>

      {lastTransaction && (
        <div className="p-4 rounded-xl border border-green-200 bg-green-50 text-sm text-green-700">
          {lastTransaction.type} transaction sent! Hash: {lastTransaction.hash.slice(0, 10)}...
        </div>
      )}

      {chainError && (
        <div className="p-4 rounded-xl border border-yellow-200 bg-yellow-50 flex items-center justify-between">
          <p className="text-sm text-yellow-700">{chainError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChainError(null)}
            className="text-yellow-700 border-yellow-300"
          >
            Dismiss
          </Button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setError(null)}
            className="text-red-600 border-red-300"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Open Positions Section */}
      {positions && positions.positions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[#606060] uppercase tracking-wide mb-3">
            Your Open Positions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {positions.positions.map((position, idx) => (
              <PositionCard
                key={idx}
                position={position}
                isOperating={isOperating}
                onWithdraw={handlePositionWithdraw}
              />
            ))}
          </div>
        </section>
      )}

      {/* Available Strategies Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#606060] uppercase tracking-wide">
            Available Strategies
          </h2>
          <div className="flex gap-2">
            {[
              { id: mainnet.id, name: "Ethereum" },
              { id: base.id, name: "Base" },
              { id: polygon.id, name: "Polygon" },
            ].map((chain) => (
              <button
                key={chain.id}
                onClick={() => handleSwitchChain(chain.id)}
                disabled={isSwitching || chainId === chain.id}
                className="px-2 py-1 text-xs rounded-md border transition-colors disabled:opacity-50"
                style={
                  chainId === chain.id
                    ? { background: "#4779FF", color: "#fff", borderColor: "#4779FF" }
                    : { background: "#fff", color: "#606060", borderColor: "#DADADA" }
                }
              >
                {chain.name}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-white border border-[#DADADA] animate-pulse" />
            ))}
          </div>
        ) : strategies && strategies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                isOperating={isOperating}
                primaryWallet={evmAccount ? { address: evmAccount.address } : null}
                onDeposit={handleDeposit}
                onWithdraw={handleWithdraw}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-[#DADADA] rounded-xl p-6 text-center">
            <p className="text-sm text-[#606060]">
              No strategies found for {getChainName(chainId)}.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// Position Card Component
function PositionCard({
  position,
  isOperating,
  onWithdraw,
}: PositionCardProps) {
  const [amount, setAmount] = useState("");

  const handleAction = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    onWithdraw(position, amount);
    setAmount("");
  };

  const apyPercent = (parseFloat(position.apy) * 100).toFixed(2);

  return (
    <div className="bg-white rounded-xl border border-[#DADADA] shadow-sm">
      <div className="p-4 border-b border-[#DADADA]">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#030303]">{position.asset.symbol}</h3>
          <span className="text-sm text-[#606060]">{position.protocol}</span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-[#606060]">Balance</p>
            <p className="text-sm font-semibold text-[#030303] mt-0.5">
              {position.balance.humanized.toFixed(4)} {position.asset.symbol}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#606060]">USD Value</p>
            <p className="text-sm font-semibold text-[#030303] mt-0.5">${position.balanceUSD}</p>
          </div>
          <div>
            <p className="text-xs text-[#606060]">Current APY</p>
            <p className="text-lg font-bold text-[#4779FF] mt-0.5">{apyPercent}%</p>
          </div>
        </div>

        {position.rewards && position.rewards.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#606060]">Rewards:</p>
            {position.rewards.map((reward, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-[#030303]">{reward.amount} {reward.token.symbol}</span>
                <span className="text-[#606060]">${reward.amountUSD}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-[#DADADA]">
          <input
            type="number"
            placeholder="Amount to withdraw"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:ring-2 focus:ring-[#4779FF]/30"
            disabled={isOperating}
            max={position.balance.humanized}
          />
          <button
            onClick={handleAction}
            disabled={
              isOperating ||
              !amount ||
              parseFloat(amount) <= 0 ||
              parseFloat(amount) > position.balance.humanized
            }
            className="w-full py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: "#DADADA", color: "#606060" }}
          >
            Withdraw
          </button>
        </div>
      </div>
    </div>
  );
}

// Strategy Card Component
function StrategyCard({
  strategy,
  isOperating,
  primaryWallet,
  onDeposit,
  onWithdraw,
}: StrategyCardProps) {
  const [amount, setAmount] = useState("");
  const [isDeposit, setIsDeposit] = useState(true);

  const handleAction = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (isDeposit) {
      onDeposit(strategy, amount);
    } else {
      onWithdraw(strategy, amount);
    }
    setAmount("");
  };

  return (
    <div className="bg-white rounded-xl border border-[#DADADA] shadow-sm">
      <div className="p-4 border-b border-[#DADADA]">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#030303]">{strategy.assetName}</h3>
          <span className="text-sm text-[#606060]">{strategy.protocol}</span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setIsDeposit(true)}
            disabled={isOperating}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors"
            style={
              isDeposit
                ? { background: "#4779FF", color: "#fff", borderColor: "#4779FF" }
                : { background: "#fff", color: "#606060", borderColor: "#DADADA" }
            }
          >
            Deposit
          </button>
          <button
            onClick={() => setIsDeposit(false)}
            disabled={isOperating}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors"
            style={
              !isDeposit
                ? { background: "#606060", color: "#fff", borderColor: "#606060" }
                : { background: "#fff", color: "#606060", borderColor: "#DADADA" }
            }
          >
            Withdraw
          </button>
        </div>

        <div className="space-y-2">
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:ring-2 focus:ring-[#4779FF]/30"
            disabled={isOperating || !primaryWallet}
          />
          <button
            onClick={handleAction}
            disabled={
              isOperating ||
              !primaryWallet ||
              !amount ||
              parseFloat(amount) <= 0
            }
            className="w-full py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: isDeposit ? "#4779FF" : "#606060" }}
          >
            {isDeposit ? "Deposit" : "Withdraw"}
          </button>
        </div>

        {!primaryWallet && (
          <p className="text-xs text-[#606060] text-center">
            Sign in to interact with strategies
          </p>
        )}
      </div>
    </div>
  );
}
