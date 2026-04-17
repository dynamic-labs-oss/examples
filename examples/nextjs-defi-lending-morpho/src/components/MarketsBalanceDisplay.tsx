import React from "react";
import { formatUnits } from "viem";

interface MarketsBalanceDisplayProps {
  loanTokenBalance: unknown;
  collateralBalance: unknown;
  borrowed: string | null;
  supplied: string | null;
  borrowedUsd: string | null;
  suppliedUsd: string | null;
  collateral: string | null;
  collateralUsd: string | null;
  healthFactor: string | null;
  loanTokenSymbol?: string;
  collateralSymbol?: string;
  loanTokenDecimals?: number;
  collateralDecimals?: number;
}

export function MarketsBalanceDisplay({
  loanTokenBalance,
  collateralBalance,
  borrowed,
  supplied,
  borrowedUsd,
  suppliedUsd,
  collateral,
  collateralUsd,
  healthFactor,
  loanTokenSymbol = "Loan Token",
  collateralSymbol = "Collateral",
  loanTokenDecimals = 18,
  collateralDecimals = 6,
}: MarketsBalanceDisplayProps) {
  const formattedLoanTokenBalance = loanTokenBalance
    ? formatUnits(loanTokenBalance as bigint, loanTokenDecimals)
    : "-";
  const formattedCollateralBalance = collateralBalance
    ? formatUnits(collateralBalance as bigint, collateralDecimals)
    : "-";

  const getHealthFactorClass = (factor: string) => {
    const value = parseFloat(factor);
    if (value < 1.1) return "text-red-500";
    if (value < 1.5) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="mt-4 mb-2 text-sm space-y-1 border-t border-earn-border pt-4">
      <div className="flex justify-between">
        <span className="text-earn-text-secondary">Your {loanTokenSymbol} balance:</span>
        <span className="font-medium text-earn-text-primary">{formattedLoanTokenBalance}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-earn-text-secondary">Your {collateralSymbol} balance:</span>
        <span className="font-medium text-earn-text-primary">{formattedCollateralBalance}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-earn-text-secondary">Supplied ({collateralSymbol}):</span>
        <span className="font-medium text-earn-text-primary">{supplied ?? "-"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-earn-text-secondary">Supplied (USD):</span>
        <span className="font-medium text-earn-text-primary">{suppliedUsd ?? "-"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-earn-text-secondary">Collateral ({collateralSymbol}):</span>
        <span className="font-medium text-earn-text-primary">{collateral ?? "-"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-earn-text-secondary">Collateral (USD):</span>
        <span className="font-medium text-earn-text-primary">{collateralUsd ?? "-"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-earn-text-secondary">Borrowed ({loanTokenSymbol}):</span>
        <span className="font-medium text-earn-text-primary">{borrowed ?? "-"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-earn-text-secondary">Borrowed (USD):</span>
        <span className="font-medium text-earn-text-primary">{borrowedUsd ?? "-"}</span>
      </div>
      {healthFactor && (
        <div className="flex justify-between">
          <span className="text-earn-text-secondary">Health Factor:</span>
          <span className={`font-medium ${getHealthFactorClass(healthFactor)}`}>{healthFactor}</span>
        </div>
      )}
    </div>
  );
}
