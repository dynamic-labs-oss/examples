"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, Coins, ClipboardList, Repeat, ArrowDownLeft } from "lucide-react";
import { useWallet } from "@/lib/providers";
import {
  useSubscriptionOperations,
  useMyPlansOperations,
  useDelegationOperations,
  useWalletBalances,
} from "@/lib/subscriptions";

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  iconColor = "text-[#4779FF]",
  iconBg = "bg-[#4779FF]/10",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  loading?: boolean;
  iconColor?: string;
  iconBg?: string;
}) {
  return (
    <div className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <p className="text-xs font-medium text-[#606060]">{label}</p>
      </div>
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-[#606060]" />
      ) : (
        <p className="text-2xl font-bold text-[#030303]">{value}</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const { loggedIn } = useWallet();

  const { solBalance, tokenBalance, loading: loadingBalances } = useWalletBalances();
  const { userSubscriptions, loadingSubscriptions } = useSubscriptionOperations();
  const { myPlans, loadingMyPlans } = useMyPlansOperations();
  const { incomingDelegations, loadingIncoming } = useDelegationOperations();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const solDisplay = (Number(solBalance) / 1e9).toFixed(4) + " SOL";
  const usdcDisplay = (Number(tokenBalance) / 1e6).toFixed(2) + " USDC";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#030303]">Dashboard</h1>
        <p className="text-sm text-[#606060] mt-1">
          Overview of your wallet and on-chain activity.
        </p>
      </div>

      {!loggedIn ? (
        <div className="rounded-xl border border-[#DADADA] bg-white p-8 text-center">
          <Wallet className="w-10 h-10 text-[#4779FF]/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-[#030303]">Sign in to view your dashboard</p>
          <p className="text-xs text-[#606060] mt-1">
            Connect your wallet to see balances and activity.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Balances */}
          <section>
            <h2 className="text-sm font-semibold text-[#606060] uppercase tracking-wider mb-3">
              Wallet Balances
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                icon={Wallet}
                label="SOL Balance"
                value={solDisplay}
                loading={loadingBalances}
                iconColor="text-[#9945FF]"
                iconBg="bg-[#9945FF]/10"
              />
              <StatCard
                icon={Coins}
                label="USDC Balance"
                value={usdcDisplay}
                loading={loadingBalances}
                iconColor="text-[#2775CA]"
                iconBg="bg-[#2775CA]/10"
              />
            </div>
          </section>

          {/* Summary stats */}
          <section>
            <h2 className="text-sm font-semibold text-[#606060] uppercase tracking-wider mb-3">
              Activity Summary
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                icon={ClipboardList}
                label="My Plans"
                value={String(myPlans.length)}
                loading={loadingMyPlans}
              />
              <StatCard
                icon={Repeat}
                label="My Subscriptions"
                value={String(userSubscriptions.length)}
                loading={loadingSubscriptions}
              />
              <StatCard
                icon={ArrowDownLeft}
                label="Incoming Delegations"
                value={String(incomingDelegations.length)}
                loading={loadingIncoming}
                iconColor="text-green-600"
                iconBg="bg-green-50"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
