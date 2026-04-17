"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { MarketsBalanceDisplay, MarketsForm, MarketsModeSelector } from ".";
import { useMarketsData, useMarketOperations } from "@/lib/hooks";
import { Market } from "@/lib/hooks/useMarketsList";

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const { address, isConnected } = useAccount();
  const [marketsMode, setMarketsMode] = useState<
    "supply" | "withdraw" | "borrow" | "repay"
  >("supply");

  const marketsData = useMarketsData(address);
  const marketOperations = useMarketOperations(address, market);

  const getMarketsSubmitHandler = () => {
    switch (marketsMode) {
      case "supply":
        return marketOperations.handleSupply;
      case "withdraw":
        return marketOperations.handleWithdraw;
      case "borrow":
        return marketOperations.handleBorrow;
      case "repay":
        return marketOperations.handleRepay;
      default:
        return marketOperations.handleSupply;
    }
  };

  if (!market.collateralToken?.symbol || !market.loanToken?.symbol) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-earn-border shadow-sm transition-all duration-300 hover:border-earn-primary hover:shadow-md">
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-earn-text-primary font-bold text-lg m-0">{market.name}</h3>
            <span className="bg-earn-primary text-white text-xs font-semibold px-2 py-1 rounded self-start">
              Active Market
            </span>
          </div>
          <p className="text-earn-text-secondary text-xs m-0 line-clamp-2">
            {market.description}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-earn-primary font-bold text-base">
            {market.borrowRate} APR
          </span>
          <span className="text-earn-text-secondary font-medium text-xs">
            {market.maxLtv} Max LTV
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="flex flex-col gap-2">
          <span className="text-earn-text-secondary text-xs font-medium uppercase tracking-wider">
            TVL
          </span>
          <span className="text-earn-text-primary text-base font-semibold truncate">
            {market.tvl}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-earn-text-secondary text-xs font-medium uppercase tracking-wider">
            Collateral
          </span>
          <span className="text-earn-text-primary text-base font-semibold truncate">
            {market.collateralToken.symbol}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-earn-text-secondary text-xs font-medium uppercase tracking-wider">
            Loan Token
          </span>
          <span className="text-earn-text-primary text-base font-semibold truncate">
            {market.loanToken.symbol}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <MarketsModeSelector mode={marketsMode} onModeChange={setMarketsMode} />
      </div>

      <MarketsForm
        mode={marketsMode}
        amount={marketOperations.amount}
        onAmountChange={marketOperations.setAmount}
        onSubmit={getMarketsSubmitHandler()}
        onApproveLoanToken={marketOperations.handleApproveLoanToken}
        onApproveCollateral={marketOperations.handleApproveCollateral}
        isConnected={isConnected}
        isSupplying={marketOperations.isSupplying}
        isWithdrawing={marketOperations.isWithdrawing}
        isBorrowing={marketOperations.isBorrowing}
        isRepaying={marketOperations.isRepaying}
        isApprovingLoanToken={marketOperations.isApprovingLoanToken}
        isApprovingCollateral={marketOperations.isApprovingCollateral}
        needsLoanTokenApproval={marketOperations.needsLoanTokenApproval}
        needsCollateralApproval={marketOperations.needsCollateralApproval}
        loanTokenSymbol={market.loanToken.symbol}
        collateralSymbol={market.collateralToken.symbol}
      />

      <div className="mt-4">
        <MarketsBalanceDisplay
          loanTokenBalance={marketOperations.loanTokenBalance}
          collateralBalance={marketOperations.collateralBalance}
          borrowed={marketsData.borrowed}
          supplied={marketsData.supplied}
          borrowedUsd={marketsData.borrowedUsd}
          suppliedUsd={marketsData.suppliedUsd}
          collateral={marketsData.collateral}
          collateralUsd={marketsData.collateralUsd}
          healthFactor={marketsData.healthFactor}
          loanTokenSymbol={market.loanToken.symbol}
          collateralSymbol={market.collateralToken.symbol}
          loanTokenDecimals={market.loanToken.decimals}
          collateralDecimals={market.collateralToken.decimals}
        />
      </div>
    </div>
  );
}
