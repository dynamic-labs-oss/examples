import { safeParseFloat, safeParseUSD } from "../lib/utils";
import type { MarketUserReserveSupplyPosition } from "@aave/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PrimaryWallet {
  address: string;
}

type PrimaryWalletOrNull = PrimaryWallet | null;

interface SupplyCardProps {
  supply: MarketUserReserveSupplyPosition;
  isOperating: boolean;
  primaryWallet: PrimaryWalletOrNull;
  onSupply: (
    marketAddress: string,
    currencyAddress: string,
    amount: string
  ) => void;
  onBorrow: (
    marketAddress: string,
    currencyAddress: string,
    amount: string
  ) => void;
  onWithdraw: (
    marketAddress: string,
    currencyAddress: string,
    amount: string
  ) => void;
}

export function SupplyCard({
  supply,
  isOperating,
  primaryWallet,
  onSupply,
  onBorrow,
  onWithdraw,
}: SupplyCardProps) {
  return (
    <Card className="w-full bg-white border border-earn-border rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-earn-text-primary">
            {supply.currency.symbol}
          </CardTitle>
          <span className="text-xs text-earn-active-text bg-earn-active-bg px-2 py-0.5 rounded-full font-medium">
            Supplied
          </span>
        </div>
        <p className="text-xs text-earn-text-secondary mt-1">{supply.market.name}</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="bg-earn-light rounded-lg px-3 py-2">
            <p className="text-xs text-earn-text-secondary">Balance</p>
            <p className="text-sm font-semibold text-earn-text-primary">
              {safeParseFloat(supply.balance.amount, 6)} {supply.currency.symbol}
            </p>
          </div>
          <div className="bg-earn-light rounded-lg px-3 py-2">
            <p className="text-xs text-earn-text-secondary">USD Value</p>
            <p className="text-sm font-semibold text-earn-text-primary">
              {safeParseUSD(supply.balance.usd)}
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
            id={`supply-more-amount-${supply.market.address}-${supply.currency.address}`}
          />
          <Button
            onClick={() => {
              const input = document.getElementById(
                `supply-more-amount-${supply.market.address}-${supply.currency.address}`
              ) as HTMLInputElement;
              onSupply(supply.market.address, supply.currency.address, input?.value || "1.0");
            }}
            disabled={isOperating || !primaryWallet}
            size="sm"
            className="bg-earn-primary hover:bg-earn-primary/90 text-white"
          >
            Supply More
          </Button>
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Amount"
            className="flex-1 text-xs px-3 py-2 border border-earn-border rounded-lg text-earn-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-earn-primary/30 focus:border-earn-primary"
            defaultValue="1.0"
            step="0.1"
            min="0"
            id={`borrow-amount-${supply.market.address}-${supply.currency.address}`}
          />
          <Button
            onClick={() => {
              const input = document.getElementById(
                `borrow-amount-${supply.market.address}-${supply.currency.address}`
              ) as HTMLInputElement;
              onBorrow(supply.market.address, supply.currency.address, input?.value || "1.0");
            }}
            disabled={isOperating || !primaryWallet}
            size="sm"
            className="bg-earn-dark hover:bg-earn-dark/90 text-white"
          >
            Borrow
          </Button>
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Amount"
            className="flex-1 text-xs px-3 py-2 border border-earn-border rounded-lg text-earn-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-earn-primary/30 focus:border-earn-primary"
            defaultValue="1.0"
            step="0.1"
            min="0"
            id={`withdraw-amount-${supply.market.address}-${supply.currency.address}`}
          />
          <Button
            onClick={() => {
              const input = document.getElementById(
                `withdraw-amount-${supply.market.address}-${supply.currency.address}`
              ) as HTMLInputElement;
              onWithdraw(supply.market.address, supply.currency.address, input?.value || "1.0");
            }}
            disabled={isOperating || !primaryWallet}
            size="sm"
            variant="outline"
            className="border-earn-border text-earn-text-primary hover:bg-earn-light"
          >
            Withdraw
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
