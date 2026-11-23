"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import type { Subscription } from "@/lib/useSubscriptions";
import { EXPLORER, TOKEN_DECIMALS, TOKEN_SYMBOL } from "@/lib/config";
import { formatPeriod, formatTime, formatTokenAmount, shortenAddress } from "@/lib/utils";

export function SubscriptionCard({
  subscription,
  onCancel,
  disabled,
}: {
  subscription: Subscription;
  onCancel: () => Promise<void>;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const statusStyles: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-amber-50 text-amber-700 border-amber-200",
    completed: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#4779FF]/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-[#4779FF]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#030303]">
              {formatTokenAmount(subscription.amount, TOKEN_DECIMALS)} {TOKEN_SYMBOL}{" "}
              {formatPeriod(subscription.period_seconds)}
            </p>
            <p className="text-xs text-[#606060] font-mono">
              → {shortenAddress(subscription.merchant)}
            </p>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusStyles[subscription.status] ?? statusStyles.active}`}
        >
          {subscription.status}
        </span>
      </div>

      {/* Pull timeline */}
      <div className="space-y-1.5">
        {(subscription.authorizations ?? []).map((a) => (
          <PullRow key={a.id} auth={a} />
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      {subscription.status === "active" && (
        <button
          onClick={handleCancel}
          disabled={loading || disabled}
          className="w-full py-2.5 rounded-lg text-sm font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel Subscription"}
        </button>
      )}
    </div>
  );
}

function PullRow({ auth }: { auth: Subscription["authorizations"][number] }) {
  const icon =
    auth.status === "posted" ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
    ) : auth.status === "cancelled" ? (
      <XCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
    ) : auth.status === "failed" ? (
      <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
    ) : (
      <Clock className="w-3.5 h-3.5 text-[#606060] shrink-0" />
    );

  return (
    <div className="flex items-center gap-2 text-xs text-[#606060]">
      {icon}
      <span className="shrink-0">Pull {auth.period_index + 1}</span>
      {auth.tx_hash ? (
        <a
          href={`${EXPLORER}/tx/${auth.tx_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto font-mono text-[#4779FF] hover:underline truncate"
        >
          {shortenAddress(auth.tx_hash, 6)}
        </a>
      ) : (
        <span className="ml-auto">
          {auth.status === "pending" ? `due ${formatTime(auth.valid_after)}` : auth.status}
        </span>
      )}
    </div>
  );
}
