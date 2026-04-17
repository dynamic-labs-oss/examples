"use client";

import { useMarketsList } from "@/lib/hooks";
import { MarketCard } from "@/components/MarketCard";

export default function BorrowPage() {
  const { markets, loading, error } = useMarketsList();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-earn-text-primary">Borrow</h1>
        <p className="text-sm text-earn-text-secondary mt-1">
          Supply collateral and borrow against it on Morpho markets
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-earn-text-primary">Markets</h2>
            {markets.length > 0 && (
              <p className="text-xs text-earn-text-secondary mt-0.5">
                {markets.length} markets available
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-white border border-earn-border animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-sm text-red-600">
            Error loading markets: {error}
          </div>
        ) : markets.length === 0 ? (
          <div className="p-6 bg-earn-light rounded-xl border border-earn-border text-sm text-earn-text-secondary text-center">
            No markets available on this network.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
