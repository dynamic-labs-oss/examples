"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Store, Search, Loader2, X, Clock } from "lucide-react";
import dynamic from "next/dynamic";
import { useWallet } from "@/lib/providers";
import { useQuery } from "@tanstack/react-query";
import { cn, shortenAddress } from "@/lib/utils";
import { useMerchantSearchOperations, useSubscriptionOperations, PlanStatus } from "@/lib/subscriptions";
import { fetchPlansForOwner } from "@solana/subscriptions";
import { address } from "@solana/kit";
import { PlanCard } from "@/components/PlanCard";

const STORAGE_KEY = "marketplace-recent";
const MAX_RECENT = 5;
const MERCHANT_CACHE_KEY = "marketplace-merchant";

type RecentEntry = { address: string; label?: string; ts: number };

function loadRecent(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(entries: RecentEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
}

function addRecent(addr: string, label?: string) {
  const entries = loadRecent().filter((e) => e.address !== addr);
  entries.unshift({ address: addr, label, ts: Date.now() });
  saveRecent(entries);
}

function removeRecent(addr: string) {
  saveRecent(loadRecent().filter((e) => e.address !== addr));
}

function MarketplaceContent() {
  const { solanaAccount, loggedIn } = useWallet();
  const [inputValue, setInputValue] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(MERCHANT_CACHE_KEY) ?? "";
    }
    return "";
  });
  const [searchAddress, setSearchAddress] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(MERCHANT_CACHE_KEY);
    }
    return null;
  });
  const [showRecent, setShowRecent] = useState(false);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { rpc, rpcUrl } = useMerchantSearchOperations();

  const {
    subscribedPlanPdas,
    cancellingPlanPdas,
    subscribeMutation,
    cancelMutation,
    resumeMutation,
    getSubscriptionPdaForPlan,
    getTokenBalance,
    tokenDecimals,
  } = useSubscriptionOperations();

  const {
    data: plans = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["merchantPlans", searchAddress, rpcUrl],
    queryFn: async () => {
      if (!searchAddress) return [];
      return fetchPlansForOwner(rpc, address(searchAddress));
    },
    enabled: !!searchAddress,
  });

  const activePlans = useMemo(() => plans.filter((p) => p.data.status === PlanStatus.Active), [plans]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  useEffect(() => {
    if (!activePlans.length || !searchAddress) return;
    const label = activePlans
      .map((p) => {
        try {
          return JSON.parse(p.data.data.metadataUri)?.n;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .join(", ");
    addRecent(searchAddress, label || undefined);
    setRecent(loadRecent());
  }, [activePlans, searchAddress]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRecent(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const refreshRecent = useCallback(() => {
    setRecent(loadRecent());
  }, []);

  const handleSearch = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed.length > 0 && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
      setSearchAddress(null);
      setShowRecent(false);
      return;
    }
    const addr = trimmed.length > 0 ? trimmed : null;
    if (addr) sessionStorage.setItem(MERCHANT_CACHE_KEY, addr);
    else sessionStorage.removeItem(MERCHANT_CACHE_KEY);
    setSearchAddress(addr);
    setShowRecent(false);
  }, [inputValue]);

  const handleSelectRecent = (addr: string) => {
    setInputValue(addr);
    sessionStorage.setItem(MERCHANT_CACHE_KEY, addr);
    setSearchAddress(addr);
    setShowRecent(false);
  };

  const handleRemoveRecent = (e: React.MouseEvent, addr: string) => {
    e.stopPropagation();
    removeRecent(addr);
    refreshRecent();
  };

  const isTransacting = subscribeMutation.isPending || cancelMutation.isPending || resumeMutation.isPending;
  const hasSearched = searchAddress !== null;
  const hasResults = activePlans.length > 0;

  return (
    <div className="space-y-6">
      {/* Search box */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            onFocus={() => {
              refreshRecent();
              const r = loadRecent();
              if (r.length > 0) setShowRecent(true);
            }}
            placeholder="Enter merchant wallet address"
            className="flex-1 min-w-0 px-4 py-2.5 border border-[#DADADA] rounded-lg text-sm outline-none focus:border-[#4779FF] font-mono bg-white text-[#030303] placeholder-[#606060]"
          />
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] disabled:opacity-50 transition-colors shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>
        {showRecent && recent.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-[#DADADA] bg-white shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#DADADA]">
              <span className="text-xs text-[#606060]">Recent searches</span>
              <button
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY);
                  refreshRecent();
                  setShowRecent(false);
                }}
                className="text-xs text-[#606060] hover:text-red-600 transition-colors"
              >
                Clear all
              </button>
            </div>
            {recent.map((entry) => (
              <button
                key={entry.address}
                onClick={() => handleSelectRecent(entry.address)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#F9F9F9] transition-colors group"
              >
                <Clock className="h-3.5 w-3.5 text-[#606060] shrink-0" />
                <span className="font-mono text-sm text-[#030303] truncate">
                  {shortenAddress(entry.address, 8)}
                </span>
                {entry.label && (
                  <span className="text-xs text-[#606060] truncate">{entry.label}</span>
                )}
                <X
                  className="h-3.5 w-3.5 ml-auto text-[#606060] opacity-0 group-hover:opacity-100 hover:text-red-600 shrink-0 transition-opacity"
                  onClick={(e) => handleRemoveRecent(e, entry.address)}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#606060]" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Failed to fetch plans. Check the address and try again.
        </div>
      )}

      {/* No results */}
      {!isLoading && hasSearched && !isError && !hasResults && (
        <div className="rounded-xl border border-dashed border-[#DADADA] bg-white p-12 flex flex-col items-center justify-center gap-2">
          <Search className="h-8 w-8 text-[#606060]" />
          <p className="text-[#606060] text-sm">No active plans found for this merchant.</p>
        </div>
      )}

      {/* Plans grid */}
      {hasResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activePlans.map((plan) => {
            const planPda = plan.address as string;
            const isSubscribed = subscribedPlanPdas.has(planPda);
            const isCancelling = cancellingPlanPdas.has(planPda);
            return (
              <PlanCardWithPda
                key={planPda}
                plan={plan}
                isSubscribed={isSubscribed}
                isCancelling={isCancelling}
                onSubscribe={async (p) => { await subscribeMutation.mutateAsync(p); }}
                onCancel={async (planAddr, subPda) => { await cancelMutation.mutateAsync({ planPda: planAddr, subscriptionPda: subPda }); }}
                onResume={async (planAddr, subPda) => { await resumeMutation.mutateAsync({ planPda: planAddr, subscriptionPda: subPda }); }}
                disabled={!loggedIn || !solanaAccount || isTransacting}
                getSubscriptionPdaForPlan={getSubscriptionPdaForPlan}
                getTokenBalance={getTokenBalance}
                tokenDecimals={tokenDecimals}
                walletAccount={solanaAccount}
              />
            );
          })}
        </div>
      )}

      {/* Empty state before search */}
      {!hasSearched && !isLoading && (
        <div className="rounded-xl border border-dashed border-[#DADADA] bg-white p-16 flex flex-col items-center justify-center gap-4">
          <Store className="h-12 w-12 text-[#030303]" />
          <h2 className="text-xl font-semibold text-[#030303]">Subscription Plans</h2>
          <p className="text-[#606060] text-center max-w-md">
            Search for a merchant address to browse their subscription plans.
          </p>
        </div>
      )}

      {!loggedIn && (
        <div className="rounded-xl border border-[#DADADA] bg-white p-6 text-center">
          <p className="text-sm text-[#606060]">
            Sign in to subscribe to plans.
          </p>
        </div>
      )}
    </div>
  );
}

// Wrapper that resolves the subscription PDA asynchronously for PlanCard
function PlanCardWithPda({
  plan, isSubscribed, isCancelling, onSubscribe, onCancel, onResume,
  disabled, getSubscriptionPdaForPlan, getTokenBalance, tokenDecimals, walletAccount,
}: {
  plan: Parameters<typeof PlanCard>[0]["plan"];
  isSubscribed: boolean;
  isCancelling: boolean;
  onSubscribe: (plan: Parameters<typeof PlanCard>[0]["plan"]) => Promise<void>;
  onCancel: (planPda: string, subscriptionPda: string) => Promise<void>;
  onResume: (planPda: string, subscriptionPda: string) => Promise<void>;
  disabled: boolean;
  getSubscriptionPdaForPlan: (planPda: string) => Promise<string | null>;
  getTokenBalance: (tokenMint: string) => Promise<bigint>;
  tokenDecimals: number;
  walletAccount: Parameters<typeof PlanCard>[0]["walletAccount"];
}) {
  const [subscriptionPda, setSubscriptionPda] = useState<string | null>(null);

  useEffect(() => {
    if (!isSubscribed && !isCancelling) { setSubscriptionPda(null); return; }
    let cancelled = false;
    getSubscriptionPdaForPlan(plan.address as string).then((pda) => {
      if (!cancelled) setSubscriptionPda(pda);
    });
    return () => { cancelled = true; };
  }, [isSubscribed, isCancelling, plan.address, getSubscriptionPdaForPlan]);

  return (
    <PlanCard
      plan={plan}
      isSubscribed={isSubscribed}
      isCancelling={isCancelling}
      subscriptionPda={subscriptionPda}
      onSubscribe={onSubscribe}
      onCancel={async () => { if (subscriptionPda) await onCancel(plan.address as string, subscriptionPda); }}
      onResume={async () => { if (subscriptionPda) await onResume(plan.address as string, subscriptionPda); }}
      disabled={disabled}
      getTokenBalance={getTokenBalance}
      walletAccount={walletAccount}
      tokenDecimals={tokenDecimals}
    />
  );
}

export default function MarketplacePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#030303]">Marketplace</h1>
        <p className="text-sm text-[#606060] mt-1">
          Search for a merchant to browse and subscribe to their on-chain subscription plans.
        </p>
      </div>
      <MarketplaceContent />
    </div>
  );
}
