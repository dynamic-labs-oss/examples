"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Clock, CheckCircle } from "lucide-react";
import { useWallet } from "@/lib/providers";
import {
  useSubscriptionOperations,
  type EnrichedSubscription,
  type UserSubscription,
} from "@/lib/subscriptions";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { parsePlanMeta } from "@/lib/utils";
import { toast } from "@/lib/toast";

function SubscriptionItem({
  enriched,
  onCancel,
  onResume,
  isTransacting,
  isPendingResume,
}: {
  enriched: EnrichedSubscription;
  onCancel: () => Promise<void>;
  onResume: () => Promise<void>;
  isTransacting: boolean;
  isPendingResume: boolean;
}) {
  const { sub, planData } = enriched;
  const isCancelled = sub.data.expiresAtTs > 0n;
  const planMeta = planData ? parsePlanMeta(planData.data.data.metadataUri) : {};
  const now = Math.floor(Date.now() / 1000);
  const canResume =
    isCancelled &&
    (sub.data.expiresAtTs === 0n || now < Number(sub.data.expiresAtTs));

  return (
    <div className="relative">
      <SubscriptionCard
        subscription={sub}
        planName={planMeta.n}
        onCancel={onCancel}
        disabled={isTransacting}
      />
      {canResume && (
        <div className="mt-2">
          <button
            onClick={onResume}
            disabled={isTransacting}
            className="w-full py-2 rounded-lg text-sm font-medium border border-[#4779FF] text-[#4779FF] bg-white hover:bg-[#E8F0FE] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPendingResume ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Resume Subscription
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function SubscriptionsBody({
  loggedIn,
  loading,
  error,
  userSubscriptions,
  enrichedSubscriptions,
  isTransacting,
  isPendingResume,
  onCancel,
  onResume,
}: {
  loggedIn: boolean;
  loading: boolean;
  error: Error | null;
  userSubscriptions: UserSubscription[];
  enrichedSubscriptions: EnrichedSubscription[];
  isTransacting: boolean;
  isPendingResume: boolean;
  onCancel: (planPda: string, subscriptionPda: string) => Promise<void>;
  onResume: (planPda: string, subscriptionPda: string) => Promise<void>;
}) {
  if (!loggedIn) {
    return (
      <div className="rounded-xl border border-[#DADADA] bg-white p-8 text-center">
        <CheckCircle className="w-10 h-10 text-[#4779FF]/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-[#030303]">Sign in to view your subscriptions</p>
        <p className="text-xs text-[#606060] mt-1">
          Connect your wallet to see your active and cancelled subscriptions.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#606060]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading subscriptions…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Failed to load subscriptions: {error.message}
      </div>
    );
  }

  if (userSubscriptions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#DADADA] bg-white p-12 text-center">
        <Clock className="w-10 h-10 text-[#606060]/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-[#030303]">No subscriptions yet</p>
        <p className="text-xs text-[#606060] mt-1">
          Visit the{" "}
          <a href="/" className="text-[#4779FF] hover:underline">
            Marketplace
          </a>{" "}
          to subscribe to a plan.
        </p>
      </div>
    );
  }

  if (enrichedSubscriptions.length > 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {enrichedSubscriptions.map(({ sub, planData }) => (
          <SubscriptionItem
            key={sub.address}
            enriched={{ sub, planData }}
            onCancel={() => onCancel(sub.data.header.delegatee as string, sub.address)}
            onResume={() => onResume(sub.data.header.delegatee as string, sub.address)}
            isTransacting={isTransacting}
            isPendingResume={isPendingResume}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {userSubscriptions.map((sub) => (
        <SubscriptionCard
          key={sub.address}
          subscription={sub}
          onCancel={() => onCancel(sub.data.header.delegatee as string, sub.address)}
          disabled={isTransacting}
        />
      ))}
    </div>
  );
}

export default function SubscriptionsPage() {
  const [mounted, setMounted] = useState(false);
  const { loggedIn } = useWallet();

  const {
    userSubscriptions,
    enrichedSubscriptions,
    loadingSubscriptions,
    subscriptionsError,
    cancelMutation,
    resumeMutation,
  } = useSubscriptionOperations();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isTransacting = cancelMutation.isPending || resumeMutation.isPending;

  const handleCancel = async (planPda: string, subscriptionPda: string) => {
    try {
      await cancelMutation.mutateAsync({ planPda, subscriptionPda });
      toast.success("Subscription cancelled.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Cancel failed";
      toast.error(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
    }
  };

  const handleResume = async (planPda: string, subscriptionPda: string) => {
    try {
      await resumeMutation.mutateAsync({ planPda, subscriptionPda });
      toast.success("Subscription resumed!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Resume failed";
      toast.error(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#030303]">My Subscriptions</h1>
        <p className="text-sm text-[#606060] mt-1">
          View and manage your on-chain subscriptions.
        </p>
      </div>
      <SubscriptionsBody
        loggedIn={loggedIn}
        loading={loadingSubscriptions}
        error={subscriptionsError as Error | null}
        userSubscriptions={userSubscriptions}
        enrichedSubscriptions={enrichedSubscriptions}
        isTransacting={isTransacting}
        isPendingResume={resumeMutation.isPending}
        onCancel={handleCancel}
        onResume={handleResume}
      />
    </div>
  );
}
