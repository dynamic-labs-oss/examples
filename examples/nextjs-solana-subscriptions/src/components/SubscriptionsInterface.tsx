"use client";

import { useState, useEffect } from "react";
import { Loader2, Repeat, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/providers";
import { useSubscriptionOperations } from "@/lib/subscriptions";
import { PlanCard } from "./PlanCard";
import { SubscriptionCard } from "./SubscriptionCard";

type Tab = "plans" | "subscriptions";

export function SubscriptionsInterface() {
  const { solanaAccount, loggedIn } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>("plans");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const {
    activePlans,
    userSubscriptions,
    subscribedPlanPdas,
    loadingPlans,
    loadingSubscriptions,
    plansError,
    subscriptionsError,
    subscribeMutation,
    cancelMutation,
    merchantAddress,
    tokenDecimals,
    getSubscriptionPdaForPlan,
    getTokenBalance,
  } = useSubscriptionOperations();

  const isTransacting =
    subscribeMutation.isPending || cancelMutation.isPending;

  const handleSubscribe = async (plan: (typeof activePlans)[0]) => {
    await subscribeMutation.mutateAsync(plan);
  };

  const handleCancel = async (planPda: string, subscriptionPda: string) => {
    await cancelMutation.mutateAsync({ planPda, subscriptionPda });
  };

  if (!mounted) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#030303]">
          Solana Subscriptions
        </h1>
        <p className="text-sm text-[#606060] mt-1">
          Subscribe to on-chain recurring payment plans powered by{" "}
          <a
            href="https://solana.com/docs/payments/subscriptions/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4779FF] hover:underline"
          >
            the Solana Subscriptions program
          </a>
          . Fund your wallet from any chain via{" "}
          <a
            href="https://docs.dynamic.xyz/payments/checkout"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4779FF] hover:underline"
          >
            Dynamic Checkout
          </a>
          .
        </p>
      </div>

      {/* Auth prompt */}
      {!loggedIn && (
        <div className="rounded-xl border border-[#DADADA] bg-white p-8 text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#4779FF]/10 flex items-center justify-center mx-auto mb-3">
            <Repeat className="w-6 h-6 text-[#4779FF]" />
          </div>
          <p className="text-sm font-medium text-[#030303]">Sign in to subscribe</p>
          <p className="text-xs text-[#606060] mt-1">
            Connect your wallet to browse plans and manage subscriptions.
          </p>
        </div>
      )}

      {/* Merchant config warning */}
      {!merchantAddress && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6">
          <p className="text-sm font-medium text-amber-700">
            Configuration required
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            Set{" "}
            <code className="font-mono bg-amber-100 px-1 rounded">
              NEXT_PUBLIC_MERCHANT_ADDRESS
            </code>{" "}
            in your{" "}
            <code className="font-mono bg-amber-100 px-1 rounded">
              .env.local
            </code>{" "}
            to display subscription plans.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#F9F9F9] border border-[#DADADA] mb-6 w-fit">
        {(
          [
            { key: "plans", label: "Available Plans", Icon: Repeat },
            { key: "subscriptions", label: "My Subscriptions", Icon: LayoutList },
          ] as const
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === key
                ? "bg-white text-[#030303] shadow-sm border border-[#DADADA]"
                : "text-[#606060] hover:text-[#030303]"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === "subscriptions" && userSubscriptions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-[#4779FF] text-white leading-none">
                {
                  userSubscriptions.filter(
                    (s) => s.data.expiresAtTs === 0n
                  ).length
                }
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Plans tab */}
      {activeTab === "plans" && (
        <>
          {loadingPlans ? (
            <div className="flex items-center justify-center py-16 text-[#606060]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading plans…
            </div>
          ) : plansError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              Failed to load plans: {(plansError as Error).message}
            </div>
          ) : activePlans.length === 0 ? (
            <div className="rounded-xl border border-[#DADADA] bg-white p-8 text-center text-sm text-[#606060]">
              {merchantAddress
                ? "No active plans found for this merchant."
                : "Configure a merchant address to see available plans."}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activePlans.map((plan) => {
                const planPda = plan.address as string;
                const isSubscribed = subscribedPlanPdas.has(planPda);
                return (
                  <PlanCardWithPda
                    key={planPda}
                    plan={plan}
                    isSubscribed={isSubscribed}
                    onSubscribe={handleSubscribe}
                    onCancel={handleCancel}
                    disabled={!loggedIn || isTransacting}
                    getSubscriptionPdaForPlan={getSubscriptionPdaForPlan}
                    getTokenBalance={getTokenBalance}
                    tokenDecimals={tokenDecimals}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* My subscriptions tab */}
      {activeTab === "subscriptions" && (
        <>
          {!loggedIn ? (
            <div className="rounded-xl border border-[#DADADA] bg-white p-8 text-center text-sm text-[#606060]">
              Sign in to view your subscriptions.
            </div>
          ) : loadingSubscriptions ? (
            <div className="flex items-center justify-center py-16 text-[#606060]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading subscriptions…
            </div>
          ) : subscriptionsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              Failed to load subscriptions: {(subscriptionsError as Error).message}
            </div>
          ) : userSubscriptions.length === 0 ? (
            <div className="rounded-xl border border-[#DADADA] bg-white p-8 text-center text-sm text-[#606060]">
              You have no subscriptions yet.{" "}
              <button
                onClick={() => setActiveTab("plans")}
                className="text-[#4779FF] hover:underline"
              >
                Browse available plans
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {userSubscriptions.map((sub) => (
                <SubscriptionCard
                  key={sub.address}
                  subscription={sub}
                  onCancel={() =>
                    handleCancel(
                      sub.data.header.delegatee as string,
                      sub.address
                    )
                  }
                  disabled={isTransacting}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Global error from mutations */}
      {(subscribeMutation.error || cancelMutation.error) && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 shadow-lg max-w-sm text-center z-40">
          {(
            (subscribeMutation.error || cancelMutation.error) as Error
          )?.message || "Transaction failed"}
        </div>
      )}
    </div>
  );
}

// Wrapper that resolves the subscription PDA asynchronously for PlanCard
function PlanCardWithPda({
  plan,
  isSubscribed,
  onSubscribe,
  onCancel,
  disabled,
  getSubscriptionPdaForPlan,
  getTokenBalance,
  tokenDecimals,
}: {
  plan: Parameters<typeof PlanCard>[0]["plan"];
  isSubscribed: boolean;
  onSubscribe: (plan: Parameters<typeof PlanCard>[0]["plan"]) => Promise<void>;
  onCancel: (planPda: string, subscriptionPda: string) => Promise<void>;
  disabled: boolean;
  getSubscriptionPdaForPlan: (planPda: string) => Promise<string | null>;
  getTokenBalance: (tokenMint: string) => Promise<bigint>;
  tokenDecimals: number;
}) {
  const [subscriptionPda, setSubscriptionPda] = useState<string | null>(null);

  useEffect(() => {
    if (!isSubscribed) {
      setSubscriptionPda(null);
      return;
    }
    let cancelled = false;
    getSubscriptionPdaForPlan(plan.address as string).then((pda) => {
      if (!cancelled) setSubscriptionPda(pda);
    });
    return () => {
      cancelled = true;
    };
  }, [isSubscribed, plan.address, getSubscriptionPdaForPlan]);

  const handleCancel = async () => {
    if (!subscriptionPda) return;
    await onCancel(plan.address as string, subscriptionPda);
  };

  return (
    <PlanCard
      plan={plan}
      isSubscribed={isSubscribed}
      subscriptionPda={subscriptionPda}
      onSubscribe={onSubscribe}
      onCancel={handleCancel}
      disabled={disabled}
      getTokenBalance={getTokenBalance}
      tokenDecimals={tokenDecimals}
    />
  );
}
