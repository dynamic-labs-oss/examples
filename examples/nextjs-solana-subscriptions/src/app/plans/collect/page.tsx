"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, DollarSign, Star, Users } from "lucide-react";
import { useWallet } from "@/lib/providers";
import { useCollectPaymentsOperations } from "@/lib/subscriptions";
import { toast } from "@/lib/toast";
import { parsePlanMeta, formatTokenAmount, formatPeriod, shortenAddress, getTokenInfo } from "@/lib/utils";
import { ICON_MAP } from "@/lib/plan-constants";
import type { SubscriptionDelegation } from "@/lib/subscriptions";
import type { Address } from "@solana/kit";

type Subscriber = {
  address: string;
  data: SubscriptionDelegation;
};

type PlanSubscribers = {
  planAddress: string;
  subscribers: Subscriber[];
  loading: boolean;
  loaded: boolean;
};

export default function CollectPage() {
  const [mounted, setMounted] = useState(false);
  const [planSubscribers, setPlanSubscribers] = useState<Record<string, PlanSubscribers>>({});
  const [collectingPlan, setCollectingPlan] = useState<string | null>(null);
  const [collectResults, setCollectResults] = useState<Record<string, string>>({});
  const { loggedIn } = useWallet();

  const { myPlans, loadingPlans, collectPaymentMutation, fetchPlanSubscribers, tokenMintStr } =
    useCollectPaymentsOperations();

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadSubscribersForPlan = useCallback(
    async (planAddress: string) => {
      setPlanSubscribers((prev) => ({
        ...prev,
        [planAddress]: {
          planAddress,
          subscribers: prev[planAddress]?.subscribers ?? [],
          loading: true,
          loaded: false,
        },
      }));
      try {
        const subs = await fetchPlanSubscribers(planAddress);
        setPlanSubscribers((prev) => ({
          ...prev,
          [planAddress]: {
            planAddress,
            subscribers: subs as Subscriber[],
            loading: false,
            loaded: true,
          },
        }));
      } catch {
        setPlanSubscribers((prev) => ({
          ...prev,
          [planAddress]: {
            planAddress,
            subscribers: [],
            loading: false,
            loaded: true,
          },
        }));
      }
    },
    [fetchPlanSubscribers]
  );

  const handleCollectForPlan = useCallback(
    async (planAddress: string) => {
      const planSubs = planSubscribers[planAddress];
      if (!planSubs || planSubs.subscribers.length === 0) return;

      setCollectingPlan(planAddress);
      setCollectResults((prev) => ({ ...prev, [planAddress]: "" }));

      let collected = 0;
      let errors = 0;

      let lastError = "";
      for (const sub of planSubs.subscribers) {
        // Only collect from active subscriptions (expiresAtTs === 0n means active)
        if (sub.data.expiresAtTs !== 0n) continue;
        try {
          await collectPaymentMutation.mutateAsync({
            planAddress,
            subscriptionAddress: sub.address,
            delegatorAddress: sub.data.header.delegator as string,
            amount: sub.data.terms.amount,
          });
          collected++;
        } catch (err) {
          errors++;
          lastError = err instanceof Error ? err.message : String(err);
        }
      }

      const resultMsg = errors > 0
        ? `Collected ${collected}, ${errors} failed${lastError ? `: ${lastError.slice(0, 80)}` : ""}`
        : `Collected ${collected} payment${collected !== 1 ? "s" : ""}`;
      setCollectResults((prev) => ({ ...prev, [planAddress]: resultMsg }));
      if (errors > 0) {
        toast.error(resultMsg);
      } else {
        toast.success(resultMsg);
      }
      setCollectingPlan(null);
    },
    [planSubscribers, collectPaymentMutation]
  );

  if (!mounted) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#030303]">Collect Payments</h1>
        <p className="text-sm text-[#606060] mt-1">
          Collect recurring payments from your subscribers.
        </p>
      </div>
      <CollectBody
        loggedIn={loggedIn}
        loading={loadingPlans}
        plans={myPlans}
        planSubscribers={planSubscribers}
        collectingPlan={collectingPlan}
        collectResults={collectResults}
        tokenMintStr={tokenMintStr}
        onLoadSubscribers={loadSubscribersForPlan}
        onCollect={handleCollectForPlan}
      />
    </div>
  );
}

type CollectBodyProps = {
  loggedIn: boolean;
  loading: boolean;
  plans: ReturnType<typeof useCollectPaymentsOperations>["myPlans"];
  planSubscribers: Record<string, PlanSubscribers>;
  collectingPlan: string | null;
  collectResults: Record<string, string>;
  tokenMintStr: string;
  onLoadSubscribers: (planAddress: string) => void;
  onCollect: (planAddress: string) => void;
};

function CollectBody({
  loggedIn,
  loading,
  plans,
  planSubscribers,
  collectingPlan,
  collectResults,
  tokenMintStr,
  onLoadSubscribers,
  onCollect,
}: CollectBodyProps) {
  if (!loggedIn) {
    return (
      <div className="rounded-xl border border-[#DADADA] bg-white p-8 text-center">
        <DollarSign className="w-10 h-10 text-[#606060]/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-[#030303]">Sign in to collect payments</p>
        <p className="text-xs text-[#606060] mt-1">
          Connect your wallet to manage and collect from your plans.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#606060]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading plans…
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#DADADA] bg-white p-12 text-center">
        <DollarSign className="w-10 h-10 text-[#606060]/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-[#030303]">No plans found</p>
        <p className="text-xs text-[#606060] mt-1">
          Create plans in{" "}
          <a href="/plans" className="text-[#4779FF] hover:underline">
            My Plans
          </a>{" "}
          to start collecting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => {
            const planAddress = plan.address as string;
            const meta = parsePlanMeta(plan.data.data.metadataUri);
            const planName = meta.n || `Plan #${plan.data.data.planId}`;
            const PlanIcon = (meta.i && ICON_MAP[meta.i]) || Star;
            const mint = plan.data.data.mint as string;
            const token = getTokenInfo(mint || tokenMintStr);
            const { amount, periodHours } = plan.data.data.terms;
            const amountFormatted = formatTokenAmount(amount, token.decimals);
            const periodLabel = formatPeriod(periodHours);

            const planSubs = planSubscribers[planAddress];
            const activeSubscribers =
              planSubs?.subscribers.filter((s) => s.data.expiresAtTs === 0n) ?? [];
            const isCollecting = collectingPlan === planAddress;
            const collectResult = collectResults[planAddress];

            return (
              <div
                key={planAddress}
                className="rounded-xl border border-[#DADADA] bg-white overflow-hidden"
              >
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#4779FF]/10 flex items-center justify-center shrink-0">
                      <PlanIcon className="w-4 h-4 text-[#4779FF]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#030303]">{planName}</p>
                      <p className="text-xs text-[#606060]">
                        {amountFormatted} {token.symbol} {periodLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {planSubs?.loaded && (
                      <div className="flex items-center gap-1 text-xs text-[#606060]">
                        <Users className="w-3.5 h-3.5" />
                        <span>{activeSubscribers.length} active</span>
                      </div>
                    )}

                    {!planSubs?.loaded && !planSubs?.loading && (
                      <button
                        onClick={() => onLoadSubscribers(planAddress)}
                        className="px-3 py-1.5 text-xs font-medium border border-[#DADADA] rounded-lg text-[#606060] hover:text-[#030303] hover:bg-[#F9F9F9] transition-colors"
                      >
                        Load subscribers
                      </button>
                    )}

                    {planSubs?.loading && (
                      <Loader2 className="w-4 h-4 animate-spin text-[#606060]" />
                    )}

                    {planSubs?.loaded && activeSubscribers.length > 0 && (
                      <button
                        onClick={() => onCollect(planAddress)}
                        disabled={isCollecting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] disabled:opacity-50 transition-colors"
                      >
                        {isCollecting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Collecting…
                          </>
                        ) : (
                          <>
                            <DollarSign className="w-4 h-4" />
                            Collect
                          </>
                        )}
                      </button>
                    )}

                    {planSubs?.loaded && activeSubscribers.length === 0 && (
                      <span className="text-xs text-[#606060] italic">No active subscribers</span>
                    )}
                  </div>
                </div>

                {collectResult && (
                  <div className="px-5 pb-4">
                    <p
                      className={`text-xs px-3 py-2 rounded-lg ${
                        collectResult.includes("failed")
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-green-50 text-green-700 border border-green-200"
                      }`}
                    >
                      {collectResult}
                    </p>
                  </div>
                )}

                {planSubs?.loaded && planSubs.subscribers.length > 0 && (
                  <div className="border-t border-[#DADADA]">
                    <div className="px-5 py-3">
                      <p className="text-xs font-medium text-[#606060] mb-2">
                        Subscribers ({planSubs.subscribers.length})
                      </p>
                      <div className="space-y-1">
                        {planSubs.subscribers.slice(0, 5).map((sub) => {
                          const isActive = sub.data.expiresAtTs === 0n;
                          return (
                            <div
                              key={sub.address}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="font-mono text-[#606060]">
                                {shortenAddress(sub.data.header.delegator as string)}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded-full ${
                                  isActive
                                    ? "bg-green-50 text-green-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {isActive ? "Active" : "Cancelled"}
                              </span>
                            </div>
                          );
                        })}
                        {planSubs.subscribers.length > 5 && (
                          <p className="text-xs text-[#606060] text-center pt-1">
                            +{planSubs.subscribers.length - 5} more
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
    </div>
  );
}
