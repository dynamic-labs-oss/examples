import { useState } from "react";
import { safeParseUSD, safeParseHealthFactor } from "../lib/utils";
import type { Market } from "@aave/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface PrimaryWallet {
  address: string;
}

type PrimaryWalletOrNull = PrimaryWallet | null;

interface MarketCardProps {
  market: Market;
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
}

const PREFERRED_SYMBOLS = ["USDC", "PYUSD", "USDT", "DAI"];

function preferredReserve<T extends { underlyingToken: { symbol: string; address: string } }>(
  reserves: T[]
): string {
  for (const sym of PREFERRED_SYMBOLS) {
    const match = reserves.find((r) => r.underlyingToken.symbol === sym);
    if (match) return match.underlyingToken.address;
  }
  return reserves[0]?.underlyingToken.address ?? "";
}

export function MarketCard({
  market,
  isOperating,
  primaryWallet,
  onSupply,
  onBorrow,
}: MarketCardProps) {
  const [selectedSupplyToken, setSelectedSupplyToken] = useState<string>(
    () => preferredReserve(market.supplyReserves)
  );
  const [selectedBorrowToken, setSelectedBorrowToken] = useState<string>(
    () => preferredReserve(market.borrowReserves)
  );

  const selectedSupplyReserve = market.supplyReserves.find(
    (reserve) => reserve.underlyingToken.address === selectedSupplyToken
  );
  const selectedBorrowReserve = market.borrowReserves.find(
    (reserve) => reserve.underlyingToken.address === selectedBorrowToken
  );

  return (
    <Card className="w-full bg-white border border-earn-border rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-earn-text-primary">
            {market.name}
          </CardTitle>
          <span className="text-xs text-earn-text-secondary bg-earn-active-bg text-earn-active-text px-2 py-0.5 rounded-full font-medium">
            {market.chain.name}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="bg-earn-light rounded-lg px-3 py-2">
            <p className="text-xs text-earn-text-secondary">Market Size</p>
            <p className="text-sm font-medium text-earn-text-primary">
              {safeParseUSD(market.totalMarketSize)}
            </p>
          </div>
          <div className="bg-earn-light rounded-lg px-3 py-2">
            <p className="text-xs text-earn-text-secondary">Available</p>
            <p className="text-sm font-medium text-earn-text-primary">
              {safeParseUSD(market.totalAvailableLiquidity)}
            </p>
          </div>
        </div>
        {market.userState && (
          <div className="mt-2 flex gap-2">
            <div className="flex-1 bg-earn-active-bg rounded-lg px-3 py-2">
              <p className="text-xs text-earn-text-secondary">Net Worth</p>
              <p className="text-sm font-semibold text-earn-active-text">
                {safeParseUSD(market.userState.netWorth)}
              </p>
            </div>
            <div className="flex-1 bg-earn-light rounded-lg px-3 py-2">
              <p className="text-xs text-earn-text-secondary">Health Factor</p>
              <p className="text-sm font-semibold text-earn-text-primary">
                {safeParseHealthFactor(market.userState.healthFactor)}
              </p>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Supply Section */}
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-earn-text-secondary uppercase tracking-wide">
            Supply
          </h5>
          <div className="relative">
            <select
              value={selectedSupplyToken}
              onChange={(e) => setSelectedSupplyToken(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-earn-border rounded-lg text-earn-text-primary bg-white appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-earn-primary/30 focus:border-earn-primary"
              disabled={isOperating}
            >
              {[...market.supplyReserves]
                .sort((a, b) => {
                  const ai = PREFERRED_SYMBOLS.indexOf(a.underlyingToken.symbol);
                  const bi = PREFERRED_SYMBOLS.indexOf(b.underlyingToken.symbol);
                  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                })
                .map((reserve) => (
                <option
                  key={reserve.underlyingToken.address}
                  value={reserve.underlyingToken.address}
                >
                  {reserve.underlyingToken.symbol} —{" "}
                  {reserve.underlyingToken.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg className="w-3 h-3 text-earn-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {selectedSupplyReserve && (
            <div className="bg-earn-light rounded-lg px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedSupplyReserve.underlyingToken.imageUrl && (
                  <Image
                    src={selectedSupplyReserve.underlyingToken.imageUrl}
                    alt={selectedSupplyReserve.underlyingToken.symbol}
                    width={18}
                    height={18}
                    className="rounded-full"
                  />
                )}
                <span className="text-xs font-medium text-earn-text-primary">
                  {selectedSupplyReserve.underlyingToken.symbol}
                </span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-earn-text-secondary">
                  APY{" "}
                  <span className="font-semibold text-earn-primary">
                    {selectedSupplyReserve.supplyInfo.apy.formatted}%
                  </span>
                </span>
                <span className="text-earn-text-secondary">
                  Max LTV{" "}
                  <span className="font-medium text-earn-text-primary">
                    {selectedSupplyReserve.supplyInfo.maxLTV.formatted}%
                  </span>
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              className="flex-1 text-xs px-3 py-2 border border-earn-border rounded-lg text-earn-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-earn-primary/30 focus:border-earn-primary"
              defaultValue="1.0"
              step="0.1"
              min="0"
              id={`supply-amount-${market.address}`}
            />
            <Button
              onClick={() => {
                if (selectedSupplyReserve) {
                  const input = document.getElementById(`supply-amount-${market.address}`) as HTMLInputElement;
                  onSupply(market.address, selectedSupplyReserve.underlyingToken.address, input?.value || "1.0");
                }
              }}
              disabled={isOperating || !primaryWallet || !selectedSupplyReserve}
              size="sm"
              className="bg-earn-primary hover:bg-earn-primary/90 text-white"
            >
              Supply
            </Button>
          </div>
        </div>

        <div className="border-t border-earn-border" />

        {/* Borrow Section */}
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-earn-text-secondary uppercase tracking-wide">
            Borrow
          </h5>
          <div className="relative">
            <select
              value={selectedBorrowToken}
              onChange={(e) => setSelectedBorrowToken(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-earn-border rounded-lg text-earn-text-primary bg-white appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-earn-primary/30 focus:border-earn-primary"
              disabled={isOperating}
            >
              {[...market.borrowReserves]
                .sort((a, b) => {
                  const ai = PREFERRED_SYMBOLS.indexOf(a.underlyingToken.symbol);
                  const bi = PREFERRED_SYMBOLS.indexOf(b.underlyingToken.symbol);
                  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                })
                .map((reserve) => (
                <option
                  key={reserve.underlyingToken.address}
                  value={reserve.underlyingToken.address}
                >
                  {reserve.underlyingToken.symbol} —{" "}
                  {reserve.underlyingToken.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg className="w-3 h-3 text-earn-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {selectedBorrowReserve && selectedBorrowReserve.borrowInfo && (
            <div className="bg-earn-light rounded-lg px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedBorrowReserve.underlyingToken.imageUrl && (
                  <Image
                    src={selectedBorrowReserve.underlyingToken.imageUrl}
                    alt={selectedBorrowReserve.underlyingToken.symbol}
                    width={18}
                    height={18}
                    className="rounded-full"
                  />
                )}
                <span className="text-xs font-medium text-earn-text-primary">
                  {selectedBorrowReserve.underlyingToken.symbol}
                </span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-earn-text-secondary">
                  APR{" "}
                  <span className="font-semibold text-earn-primary">
                    {selectedBorrowReserve.borrowInfo.apy.formatted}%
                  </span>
                </span>
                <span className="text-earn-text-secondary">
                  Available{" "}
                  <span className="font-medium text-earn-text-primary">
                    {safeParseUSD(selectedBorrowReserve.borrowInfo.availableLiquidity.usd)}
                  </span>
                </span>
              </div>
            </div>
          )}

          {!market.userState && primaryWallet && (
            <p className="text-xs text-earn-text-secondary">
              Supply collateral first to enable borrowing.
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              className="flex-1 text-xs px-3 py-2 border border-earn-border rounded-lg text-earn-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-earn-primary/30 focus:border-earn-primary"
              defaultValue="1.0"
              step="0.1"
              min="0"
              id={`borrow-amount-${market.address}`}
              disabled={!market.userState}
            />
            <Button
              onClick={() => {
                if (selectedBorrowReserve) {
                  const input = document.getElementById(`borrow-amount-${market.address}`) as HTMLInputElement;
                  onBorrow(market.address, selectedBorrowReserve.underlyingToken.address, input?.value || "1.0");
                }
              }}
              disabled={isOperating || !primaryWallet || !selectedBorrowReserve || !market.userState}
              size="sm"
              className="bg-earn-dark hover:bg-earn-dark/90 text-white"
            >
              Borrow
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
