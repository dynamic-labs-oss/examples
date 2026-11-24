"use client";

import { useEffect, useState } from "react";
import { Loader2, Play, RefreshCw, Wallet } from "lucide-react";
import { useWallet } from "@/lib/useWallet";
import { useSubscriptions } from "@/lib/useSubscriptions";
import { useChain } from "@/lib/chain";
import { ChainSwitcher } from "@/components/ChainSwitcher";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { SolanaSubscriptions } from "@/components/SolanaSubscriptions";

export default function SubscriptionsPage() {
  const [mounted, setMounted] = useState(false);
  const { chain } = useChain();

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      <div className="mb-6">
        <ChainSwitcher />
      </div>
      {chain === "solana" ? <SolanaSubscriptions /> : <EvmSubscriptions />}
    </div>
  );
}

function EvmSubscriptions() {
  const { loggedIn } = useWallet();
  const { subscriptions, isLoading, cancelMutation, collectMutation } = useSubscriptions();

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#030303]">My Subscriptions</h1>
          <p className="text-sm text-[#606060] mt-1">
            Active pull-payment authorizations signed from your wallet.
          </p>
        </div>
        <button
          onClick={() => collectMutation.mutate()}
          disabled={collectMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-white border border-[#DADADA] text-[#030303] hover:bg-[#F9F9F9] disabled:opacity-50 transition-colors shrink-0"
        >
          {collectMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Collect due pulls
        </button>
      </div>

      {!loggedIn && (
        <div className="rounded-xl border border-[#DADADA] bg-white p-10 flex flex-col items-center gap-3">
          <Wallet className="h-8 w-8 text-[#606060]" />
          <p className="text-sm text-[#606060]">Connect a wallet to view subscriptions.</p>
        </div>
      )}

      {loggedIn && isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#606060]" />
        </div>
      )}

      {loggedIn && !isLoading && subscriptions.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#DADADA] bg-white p-16 flex flex-col items-center gap-3">
          <RefreshCw className="h-10 w-10 text-[#030303]" />
          <h2 className="text-lg font-semibold text-[#030303]">No subscriptions yet</h2>
          <p className="text-sm text-[#606060] text-center max-w-md">
            Head to the subscribe page and sign the plan authorizations — each pull
            then happens automatically on schedule.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subscriptions.map((sub) => (
          <SubscriptionCard
            key={sub.id}
            subscription={sub}
            onCancel={() => cancelMutation.mutateAsync(sub.id)}
            disabled={cancelMutation.isPending}
          />
        ))}
      </div>
    </>
  );
}
