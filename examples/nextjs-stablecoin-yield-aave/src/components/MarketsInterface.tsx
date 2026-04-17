"use client";

import {
  chainId as aaveChainId,
  evmAddress,
  useAaveMarkets,
  useUserBorrows,
  useUserSupplies,
} from "@aave/react";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useEffect, useState } from "react";
import { WalletClient } from "viem";
import { useChainId } from "wagmi";
import { mainnet, base, polygon } from "viem/chains";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTransactionOperations } from "../lib/useTransactionOperations";
import { getChainName } from "../lib/utils";
import { BorrowCard } from "./BorrowCard";
import { MarketCard } from "./MarketCard";
import { SupplyCard } from "./SupplyCard";

// urql (used inside @aave/react hooks) triggers a synchronous setState on its
// first render, which React 19 rejects in concurrent mode.  We work around this
// by deferring the mount of the inner component by one commit so its hooks
// always execute in their own render cycle.
export function MarketsInterface() {
  const chainId = useChainId();
  const { primaryWallet } = useDynamicContext();
  const address = primaryWallet?.address ?? "disconnected";
  const mountKey = `${chainId}-${address}`;

  const [activeKey, setActiveKey] = useState<string | null>(null);
  useEffect(() => {
    setActiveKey(mountKey);
  }, [mountKey]);

  if (activeKey !== mountKey) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-earn-text-secondary text-sm">Loading markets...</p>
      </div>
    );
  }

  return <MarketsInterfaceInner key={mountKey} />;
}

function MarketsInterfaceInner() {
  const { primaryWallet } = useDynamicContext();
  const chainId = useChainId();
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  useEffect(() => {
    if (primaryWallet && isEthereumWallet(primaryWallet)) {
      primaryWallet.getWalletClient().then(setWalletClient);
    }
  }, [primaryWallet]);

  const handleSwitchChain = async (targetChainId: number) => {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
      setChainError("Wallet not connected");
      return;
    }

    setIsSwitching(true);
    setChainError(null);

    try {
      if (primaryWallet.connector.supportsNetworkSwitching()) {
        await primaryWallet.switchNetwork(targetChainId);
      } else {
        setChainError("Your wallet doesn't support network switching");
      }
    } catch {
      setChainError("Failed to switch chain. Please try again.");
    } finally {
      setIsSwitching(false);
    }
  };

  const {
    isOperating,
    executeSupply,
    executeBorrow,
    executeRepay,
    executeWithdraw,
  } = useTransactionOperations(walletClient, chainId);

  const FEATURED_SYMBOLS = ["PYUSD"];

  const {
    data: markets,
    loading: marketsLoading,
    error: marketsError,
  } = useAaveMarkets({
    chainIds: [aaveChainId(chainId)],
    user: primaryWallet?.address
      ? evmAddress(primaryWallet.address)
      : undefined,
  });

  const hasFeaturedReserve = (m: NonNullable<typeof markets>[number]) =>
    m.supplyReserves.some((r) => FEATURED_SYMBOLS.includes(r.underlyingToken.symbol));

  const sortedMarkets = (markets ?? []).slice().sort((a, b) => {
    const aFeatured = hasFeaturedReserve(a);
    const bFeatured = hasFeaturedReserve(b);
    if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
    return 0;
  });

  const marketRefs =
    markets?.map((market) => ({
      chainId: market.chain.chainId,
      address: market.address,
    })) ?? [];

  const {
    data: userSupplies,
    loading: userSuppliesLoading,
    error: userSuppliesError,
  } = useUserSupplies({
    markets: marketRefs,
    user: primaryWallet?.address
      ? evmAddress(primaryWallet.address)
      : undefined,
  });

  const {
    data: userBorrows,
    loading: userBorrowsLoading,
    error: userBorrowsError,
  } = useUserBorrows({
    markets: marketRefs,
    user: primaryWallet?.address
      ? evmAddress(primaryWallet.address)
      : undefined,
  });

  const friendlyError = (action: string, error: unknown): string => {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("execution reverted")) {
      if (action === "Borrow") {
        return "Borrow reverted — you may not have enough collateral. Supply assets first, then try again.";
      }
      return `${action} reverted — check your balance and collateral, then try again.`;
    }
    if (msg.includes("User rejected") || msg.includes("user rejected")) {
      return `${action} was cancelled.`;
    }
    return `${action} failed: ${msg}`;
  };

  const handleSupply = async (
    marketAddress: string,
    currencyAddress: string,
    amount: string
  ) => {
    setTxError(null);
    try {
      await executeSupply(marketAddress, currencyAddress, amount);
    } catch (error) {
      setTxError(friendlyError("Supply", error));
    }
  };

  const handleBorrow = async (
    marketAddress: string,
    currencyAddress: string,
    amount: string
  ) => {
    setTxError(null);
    try {
      await executeBorrow(marketAddress, currencyAddress, amount);
    } catch (error) {
      setTxError(friendlyError("Borrow", error));
    }
  };

  const handleRepay = async (
    marketAddress: string,
    currencyAddress: string,
    amount: string | "max"
  ) => {
    setTxError(null);
    try {
      await executeRepay(marketAddress, currencyAddress, amount);
    } catch (error) {
      setTxError(friendlyError("Repay", error));
    }
  };

  const handleWithdraw = async (
    marketAddress: string,
    currencyAddress: string,
    amount: string
  ) => {
    setTxError(null);
    try {
      await executeWithdraw(marketAddress, currencyAddress, amount);
    } catch (error) {
      setTxError(friendlyError("Withdraw", error));
    }
  };

  if (chainError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-white border border-earn-border rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-center text-destructive text-base">
              Connection Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-earn-text-secondary text-sm">{chainError}</p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-earn-primary hover:bg-earn-primary/90 text-white"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSwitching) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-white border border-earn-border rounded-xl shadow-sm">
          <CardContent className="pt-6 pb-6">
            <p className="text-center text-earn-text-secondary text-sm">
              Switching to {getChainName(chainId)}...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-earn-text-primary">
          Aave Markets
        </h1>
        <p className="text-sm text-earn-text-secondary mt-1">
          Supply assets and borrow against your collateral on {getChainName(chainId)}
        </p>
      </div>

      {txError && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          <p className="text-sm text-destructive flex-1">{txError}</p>
          <button
            onClick={() => setTxError(null)}
            className="text-destructive/60 hover:text-destructive text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-earn-text-secondary uppercase tracking-wide mb-3">
          Available Markets
        </h2>
        {marketsLoading ? (
          <div className="bg-white border border-earn-border rounded-xl p-6">
            <p className="text-earn-text-secondary text-sm">Loading markets...</p>
          </div>
        ) : marketsError ? (
          <div className="bg-white border border-earn-border rounded-xl p-6">
            <p className="text-destructive text-sm">
              Error loading markets: {String(marketsError)}
            </p>
          </div>
        ) : sortedMarkets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedMarkets.map((market) => (
              <MarketCard
                key={market.address}
                market={market}
                isOperating={isOperating}
                primaryWallet={primaryWallet}
                onSupply={handleSupply}
                onBorrow={handleBorrow}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-earn-border rounded-xl p-6 space-y-4">
            <p className="text-earn-text-secondary text-sm">
              No markets found for {getChainName(chainId)}.
            </p>
            <div className="space-y-2">
              <p className="text-xs text-earn-text-secondary">
                Try switching to a supported network:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSwitchChain(mainnet.id)}
                  disabled={isSwitching || Number(chainId) === mainnet.id}
                  className="border-earn-border text-earn-text-primary hover:bg-earn-light"
                >
                  {mainnet.name}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSwitchChain(base.id)}
                  disabled={isSwitching || Number(chainId) === base.id}
                  className="border-earn-border text-earn-text-primary hover:bg-earn-light"
                >
                  {base.name}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSwitchChain(polygon.id)}
                  disabled={isSwitching || Number(chainId) === polygon.id}
                  className="border-earn-border text-earn-text-primary hover:bg-earn-light"
                >
                  {polygon.name}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {primaryWallet && (
        <>
          <section>
            <h2 className="text-sm font-semibold text-earn-text-secondary uppercase tracking-wide mb-3">
              Your Supplies
            </h2>
            {userSuppliesLoading ? (
              <div className="bg-white border border-earn-border rounded-xl p-6">
                <p className="text-earn-text-secondary text-sm">Loading supplies...</p>
              </div>
            ) : userSuppliesError ? (
              <div className="bg-white border border-earn-border rounded-xl p-6">
                <p className="text-destructive text-sm">
                  Error loading supplies: {String(userSuppliesError)}
                </p>
              </div>
            ) : userSupplies && userSupplies.length > 0 ? (
              <div className={`grid grid-cols-1 gap-4 ${userSupplies.length >= 2 ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
                {userSupplies.map((supply) => (
                  <SupplyCard
                    key={`${supply.market.address}-${supply.currency.address}`}
                    supply={supply}
                    isOperating={isOperating}
                    primaryWallet={primaryWallet}
                    onSupply={handleSupply}
                    onBorrow={handleBorrow}
                    onWithdraw={handleWithdraw}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-earn-border rounded-xl p-6">
                <p className="text-earn-text-secondary text-sm">No active supplies.</p>
              </div>
            )}
          </section>

          <section className="pb-8">
            <h2 className="text-sm font-semibold text-earn-text-secondary uppercase tracking-wide mb-3">
              Your Borrows
            </h2>
            {userBorrowsLoading ? (
              <div className="bg-white border border-earn-border rounded-xl p-6">
                <p className="text-earn-text-secondary text-sm">Loading borrows...</p>
              </div>
            ) : userBorrowsError ? (
              <div className="bg-white border border-earn-border rounded-xl p-6">
                <p className="text-destructive text-sm">
                  Error loading borrows: {String(userBorrowsError)}
                </p>
              </div>
            ) : userBorrows && userBorrows.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userBorrows.map((borrow) => (
                  <BorrowCard
                    key={`${borrow.market.address}-${borrow.currency.address}`}
                    borrow={borrow}
                    isOperating={isOperating}
                    primaryWallet={primaryWallet}
                    onRepay={handleRepay}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-earn-border rounded-xl p-6">
                <p className="text-earn-text-secondary text-sm">No active borrows.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
