"use client";

import { useVaultsList } from "@/lib/hooks/useVaultsList";
import { useMarketsList } from "@/lib/hooks";
import { VaultCard } from "./VaultCard";
import { MarketCard } from "./MarketCard";

export function MorphoInterface() {
  const { vaults, loading: vaultsLoading, error: vaultsError } = useVaultsList("whitelisted-desc");
  const { markets, loading: marketsLoading, error: marketsError } = useMarketsList();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Earn section */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-earn-text-primary">Earn</h2>
          <p className="text-sm text-earn-text-secondary mt-0.5">
            Deposit into Morpho vaults and earn yield on your assets
          </p>
        </div>

        {vaultsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-white border border-earn-border animate-pulse" />
            ))}
          </div>
        ) : vaultsError ? (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-sm text-red-600">
            Error loading vaults: {vaultsError}
          </div>
        ) : vaults.length === 0 ? (
          <div className="p-6 bg-earn-light rounded-xl border border-earn-border text-sm text-earn-text-secondary text-center">
            No vaults available on this network.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vaults.map((vault) => (
              <VaultCard key={vault.id} vault={vault} />
            ))}
          </div>
        )}
      </section>

      {/* Borrow section */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-earn-text-primary">Borrow</h2>
          <p className="text-sm text-earn-text-secondary mt-0.5">
            Supply collateral and borrow against it on Morpho markets
          </p>
        </div>

        {marketsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-white border border-earn-border animate-pulse" />
            ))}
          </div>
        ) : marketsError ? (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-sm text-red-600">
            Error loading markets: {marketsError}
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
