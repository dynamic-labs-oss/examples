"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, Coins, ClipboardList, Repeat, ArrowDownLeft, ArrowUpCircle } from "lucide-react";
import { useWallet } from "@/lib/providers";
import { useUser } from "@dynamic-labs-sdk/react-hooks";
import {
  useSubscriptionOperations,
  useMyPlansOperations,
  useDelegationOperations,
  useWalletBalances,
} from "@/lib/subscriptions";
import { fundWalletWithSol } from "@/lib/useCheckoutFunding";
import { toast } from "@/lib/toast";

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
  const [toppingUp, setToppingUp] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("5");
  const { loggedIn, solanaAccount } = useWallet();
  const user = useUser();

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

  const handleTopUp = async () => {
    if (!solanaAccount) return;
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) return;
    setShowTopUpModal(false);
    setToppingUp(true);
    try {
      await fundWalletWithSol(amount, solanaAccount.address, solanaAccount);
      toast.success(`Topped up ${amount} USDC!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Top up failed";
      toast.error(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
    } finally {
      setToppingUp(false);
    }
  };

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
          {/* Account info */}
          <section>
            <h2 className="text-sm font-semibold text-[#606060] uppercase tracking-wider mb-3">
              Account
            </h2>
            <div className="rounded-xl border border-[#DADADA] bg-white p-5 space-y-3 text-sm">
              {user?.email && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#606060]">Email</span>
                  <span className="text-[#030303] font-medium">{user.email}</span>
                </div>
              )}
              {solanaAccount && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#606060]">Wallet</span>
                  <span className="font-mono text-xs text-[#030303]">{solanaAccount.address}</span>
                </div>
              )}
            </div>
          </section>

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
              <div className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#2775CA]/10 flex items-center justify-center shrink-0">
                      <Coins className="w-4 h-4 text-[#2775CA]" />
                    </div>
                    <p className="text-xs font-medium text-[#606060]">USDC Balance</p>
                  </div>
                  <button
                    onClick={() => setShowTopUpModal(true)}
                    disabled={toppingUp || !solanaAccount}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] disabled:opacity-50 transition-colors"
                  >
                    {toppingUp ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpCircle className="w-3 h-3" />}
                    {toppingUp ? "Swapping…" : "Top Up"}
                  </button>
                </div>
                {loadingBalances ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#606060]" />
                ) : (
                  <p className="text-2xl font-bold text-[#030303]">{usdcDisplay}</p>
                )}
              </div>
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

      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl border border-[#DADADA] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#030303]">Top Up USDC</h2>
            <p className="text-xs text-[#606060]">Swap SOL → USDC via Dynamic. Enter the USD amount to receive.</p>
            <div>
              <label className="block text-xs font-medium text-[#606060] mb-1">Amount (USD)</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="w-full rounded-lg border border-[#DADADA] px-3 py-2 text-sm text-[#030303] focus:outline-none focus:ring-2 focus:ring-[#4779FF]/30"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTopUpModal(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium border border-[#DADADA] text-[#606060] hover:bg-[#F9F9F9] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTopUp}
                disabled={!topUpAmount || parseFloat(topUpAmount) <= 0}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] disabled:opacity-50 transition-colors"
              >
                Swap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
