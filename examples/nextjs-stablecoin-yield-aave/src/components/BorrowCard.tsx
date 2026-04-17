import { safeParseFloat, safeParseUSD } from "../lib/utils";
import type { MarketUserReserveBorrowPosition } from "@aave/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PrimaryWallet {
  address: string;
}

type PrimaryWalletOrNull = PrimaryWallet | null;

interface BorrowCardProps {
  borrow: MarketUserReserveBorrowPosition;
  isOperating: boolean;
  primaryWallet: PrimaryWalletOrNull;
  onRepay: (
    marketAddress: string,
    currencyAddress: string,
    amount: string | "max"
  ) => void;
}

export function BorrowCard({
  borrow,
  isOperating,
  primaryWallet,
  onRepay,
}: BorrowCardProps) {
  return (
    <Card className="w-full bg-white border border-earn-border rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-earn-text-primary">
            {borrow.currency.symbol}
          </CardTitle>
          <span className="text-xs text-earn-text-secondary bg-earn-light px-2 py-0.5 rounded-full font-medium">
            Borrowed
          </span>
        </div>
        <p className="text-xs text-earn-text-secondary mt-1">{borrow.market.name}</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="bg-earn-light rounded-lg px-3 py-2">
            <p className="text-xs text-earn-text-secondary">Debt</p>
            <p className="text-sm font-semibold text-earn-text-primary">
              {safeParseFloat(borrow.debt.amount, 6)} {borrow.currency.symbol}
            </p>
          </div>
          <div className="bg-earn-light rounded-lg px-3 py-2">
            <p className="text-xs text-earn-text-secondary">USD Value</p>
            <p className="text-sm font-semibold text-earn-text-primary">
              {safeParseUSD(borrow.debt.usd)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Amount"
            className="flex-1 text-xs px-3 py-2 border border-earn-border rounded-lg text-earn-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-earn-primary/30 focus:border-earn-primary"
            defaultValue="1.0"
            step="0.1"
            min="0"
            id={`repay-amount-${borrow.market.address}-${borrow.currency.address}`}
          />
          <Button
            onClick={() => {
              const input = document.getElementById(
                `repay-amount-${borrow.market.address}-${borrow.currency.address}`
              ) as HTMLInputElement;
              onRepay(borrow.market.address, borrow.currency.address, input?.value || "1.0");
            }}
            disabled={isOperating || !primaryWallet}
            size="sm"
            className="bg-earn-primary hover:bg-earn-primary/90 text-white"
          >
            Repay
          </Button>
        </div>
        <Button
          onClick={() => {
            onRepay(borrow.market.address, borrow.currency.address, "max");
          }}
          disabled={isOperating || !primaryWallet}
          size="sm"
          variant="outline"
          className="w-full border-earn-border text-earn-text-primary hover:bg-earn-light"
        >
          Repay Max
        </Button>
      </CardContent>
    </Card>
  );
}
