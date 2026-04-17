import React from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import { DynamicConnectButton } from "@dynamic-labs/sdk-react-core";

const MARKET_MODE_CONFIG = {
  supply: {
    placeholder: "Amount in Collateral",
    buttonText: "Supply Collateral",
    loadingText: "Supplying...",
  },
  withdraw: {
    placeholder: "Amount in Collateral",
    buttonText: "Withdraw Collateral",
    loadingText: "Withdrawing...",
  },
  borrow: {
    placeholder: "Amount in Loan Token",
    buttonText: "Borrow Loan Token",
    loadingText: "Borrowing...",
  },
  repay: {
    placeholder: "Amount in Loan Token",
    buttonText: "Repay Loan Token",
    loadingText: "Repaying...",
  },
} as const;

interface MarketsFormProps {
  mode: "supply" | "withdraw" | "borrow" | "repay";
  amount: string;
  onAmountChange: (amount: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onApproveLoanToken?: () => void;
  onApproveCollateral?: () => void;
  isConnected: boolean;
  isSupplying: boolean;
  isWithdrawing: boolean;
  isBorrowing: boolean;
  isRepaying: boolean;
  isApprovingLoanToken: boolean;
  isApprovingCollateral: boolean;
  needsLoanTokenApproval: boolean;
  needsCollateralApproval: boolean;
  loanTokenSymbol?: string;
  collateralSymbol?: string;
}

export function MarketsForm({
  mode,
  amount,
  onAmountChange,
  onSubmit,
  onApproveLoanToken,
  onApproveCollateral,
  isConnected,
  isSupplying,
  isWithdrawing,
  isBorrowing,
  isRepaying,
  isApprovingLoanToken,
  isApprovingCollateral,
  needsLoanTokenApproval,
  needsCollateralApproval,
  loanTokenSymbol = "Loan Token",
  collateralSymbol = "Collateral",
}: MarketsFormProps) {
  const config = MARKET_MODE_CONFIG[mode];
  const isPending = isSupplying || isWithdrawing || isBorrowing || isRepaying;

  const needsApproval =
    mode === "borrow" || mode === "repay"
      ? needsLoanTokenApproval
      : needsCollateralApproval;
  const isApproving =
    mode === "borrow" || mode === "repay"
      ? isApprovingLoanToken
      : isApprovingCollateral;
  const onApprove =
    mode === "borrow" || mode === "repay"
      ? onApproveLoanToken
      : onApproveCollateral;

  const approveSymbol =
    mode === "borrow" || mode === "repay" ? loanTokenSymbol : collateralSymbol;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Input
        type="number"
        min={0}
        step="any"
        placeholder={config.placeholder}
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        required
      />

      {needsApproval && onApprove && (
        <Button variant="approve" loading={isApproving} onClick={onApprove}>
          {`Approve ${approveSymbol}`}
        </Button>
      )}

      {!isConnected ? (
        <DynamicConnectButton buttonClassName="bg-earn-primary text-white rounded-xl py-3 font-medium text-sm w-full cursor-pointer hover:bg-earn-primary/90 transition-colors">
          Connect Wallet
        </DynamicConnectButton>
      ) : (
        <Button
          type="submit"
          variant="primary"
          disabled={!isConnected || isPending || needsApproval}
          loading={isPending}
        >
          {isPending ? config.loadingText : config.buttonText}
        </Button>
      )}
    </form>
  );
}
