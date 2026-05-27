"use client";

import { useState } from "react";
import { Clock, Loader2, XCircle } from "lucide-react";
import { formatTokenAmount, formatPeriod, getTokenInfo, shortenAddress } from "@/lib/utils";
import type { UserSubscription } from "@/lib/subscriptions";

interface SubscriptionCardProps {
  subscription: UserSubscription;
  onCancel: () => Promise<void>;
  disabled?: boolean;
  planName?: string;
}

export function SubscriptionCard({
  subscription,
  onCancel,
  disabled,
  planName,
}: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = subscription;
  const planPda = data.header.delegatee as string;
  const subscriptionPda = subscription.address;
  const isCancelling = data.expiresAtTs > 0n;

  // Terms are stored in the delegation account as a snapshot of the plan at subscribe time
  const { amount, periodHours } = data.terms;
  // Mint is not stored on the delegation — use the configured token mint from env
  const configuredMint = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";

  const token = getTokenInfo(configuredMint);
  const amountFormatted = amount > 0n ? formatTokenAmount(amount, token.decimals) : "—";
  const periodLabel = periodHours > 0n ? formatPeriod(periodHours) : "";

  const handleCancel = async () => {
    setError(null);
    setLoading(true);
    try {
      await onCancel();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Cancellation failed";
      setError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#4779FF]/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-[#4779FF]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#030303]">
              {planName || "Active Subscription"}
            </p>
            <p className="text-xs text-[#606060] font-mono">
              {shortenAddress(subscriptionPda)}
            </p>
          </div>
        </div>
        {isCancelling ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <XCircle className="w-3 h-3" />
            Cancelling
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            Active
          </span>
        )}
      </div>

      {/* Details */}
      <div className="space-y-1.5 text-xs text-[#606060]">
        {amountFormatted !== "—" && (
          <div className="flex justify-between">
            <span>Amount</span>
            <span className="font-medium text-[#030303]">
              {amountFormatted} {token.symbol} {periodLabel}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Plan</span>
          <span className="font-mono">{shortenAddress(planPda)}</span>
        </div>
        {configuredMint && (
          <div className="flex justify-between">
            <span>Token</span>
            <span className="font-mono">{shortenAddress(configuredMint)}</span>
          </div>
        )}
        {data.amountPulledInPeriod > 0n && (
          <div className="flex justify-between">
            <span>Pulled this period</span>
            <span>
              {formatTokenAmount(data.amountPulledInPeriod, token.decimals)}{" "}
              {token.symbol}
            </span>
          </div>
        )}
        {isCancelling && data.expiresAtTs > 0n && (
          <div className="flex justify-between text-amber-600">
            <span>Expires at</span>
            <span>
              {new Date(Number(data.expiresAtTs) * 1000).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Action */}
      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {!isCancelling && (
        <button
          onClick={handleCancel}
          disabled={loading || disabled}
          className="w-full py-2.5 rounded-lg text-sm font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Cancel Subscription"
          )}
        </button>
      )}
    </div>
  );
}
