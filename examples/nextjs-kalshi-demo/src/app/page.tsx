"use client";

import { Header } from "@/components/Header";
import { MarketCard } from "@/components/MarketCard";
import {
  useKalshiMarkets,
  type Market,
  calculateTimeRemaining,
} from "@/lib/hooks/useKalshiMarkets";

export default function Home() {
  const { data: markets = [], isLoading, error } = useKalshiMarkets();

  return (
    <>
      <Header />
      <div className="px-[20px] sm:px-[32px] md:px-[48px] lg:px-[64px] xl:px-[80px]">
      <div style={{ maxWidth: "1440px", margin: "0 auto" }}>

      {/* Market Cards Grid */}
      <div className="pt-[27px] pb-[93px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-[18px] text-[#606060]">
              Loading markets...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-[18px] text-[#606060]">
              Error loading markets. Please try again later.
            </p>
          </div>
        ) : markets.length > 0 ? (
          <div className="grid grid-cols-responsive gap-x-[20px] gap-y-[20px]">
            {markets.map((market: Market) => (
              <MarketCard
                key={market.id}
                question={market.question}
                timeRemaining={calculateTimeRemaining(market.endDate)}
                yesPrice={market.yesPrice}
                noPrice={market.noPrice}
                category={market.category}
                imageUrl={market.imageUrl}
                yesTraders={market.yesTraders}
                noTraders={market.noTraders}
                ticker={market.ticker}
                yesTokenMint={market.yesTokenMint}
                noTokenMint={market.noTokenMint}
                marketId={market.id}
                tags={market.tags}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-[18px] text-[#606060]">
              No markets found
            </p>
          </div>
        )}
      </div>
      </div>
      </div>
    </>
  );
}

