"use client";

import { useState } from "react";
import { Check, Loader2, Repeat, RotateCcw, Wallet, XCircle } from "lucide-react";
import { cn, formatTokenAmount, formatPeriod, getTokenInfo, shortenAddress, parsePlanMeta } from "@/lib/utils";
import { ICON_MAP } from "@/lib/plan-constants";
import type { PlanWithAddress } from "@/lib/subscriptions";
import type { SolanaWalletAccount } from "@dynamic-labs-sdk/solana";
import { fundWalletWithSol } from "@/lib/useCheckoutFunding";
import { toast } from "@/lib/toast";

interface PlanCardProps {
  plan: PlanWithAddress;
  isSubscribed: boolean;
  isCancelling?: boolean;
  subscriptionPda: string | null;
  onSubscribe: (plan: PlanWithAddress) => Promise<void>;
  onCancel: () => Promise<void>;
  onResume: () => Promise<void>;
  getTokenBalance: (tokenMint: string) => Promise<bigint>;
  walletAccount: SolanaWalletAccount | null;
  tokenDecimals: number;
  disabled?: boolean;
}

export function PlanCard({
  plan,
  isSubscribed,
  isCancelling = false,
  subscriptionPda,
  onSubscribe,
  onCancel,
  onResume,
  getTokenBalance,
  walletAccount,
  disabled,
}: PlanCardProps) {
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Subscribe");
  const [error, setError] = useState<string | null>(null);
  const [alreadyFunded, setAlreadyFunded] = useState(false);

  const { amount, periodHours, createdAt } = plan.data.data.terms;
  const mint = plan.data.data.mint as string;
  const planId = plan.data.data.planId;
  const endTs = plan.data.data.endTs;
  const metadataUri = plan.data.data.metadataUri;

  const planMeta = parsePlanMeta(metadataUri);
  const planName = planMeta.n || `Plan #${planId.toString()}`;
  const planDesc = planMeta.d || "";
  const PlanIcon = (planMeta.i && ICON_MAP[planMeta.i]) || Repeat;
  const token = getTokenInfo(mint);
  const amountFormatted = formatTokenAmount(amount, token.decimals);
  const periodLabel = formatPeriod(periodHours);
  const amountUsd = Number(amount) / 10 ** token.decimals;
  const isActive = !endTs || endTs === 0n;

  const handleSubscribe = async () => {
    setError(null);
    setLoading(true);
    setLoadingLabel("Subscribe");
    try {
      const balance = await getTokenBalance(mint);
      if (!alreadyFunded && balance < amount) {
        if (!walletAccount) throw new Error("Wallet not connected");
        setLoadingLabel("Swapping SOL → USDC…");
        await fundWalletWithSol(amountUsd, walletAccount.address, walletAccount);
        setAlreadyFunded(true);
        toast.success("Wallet funded — subscribing…");
      }
      setLoadingLabel("Subscribing…");
      try {
        await onSubscribe(plan);
      } catch (err) {
        // Already subscribed — state was stale, just refresh
        if (String(err).includes("0x205")) { setAlreadyFunded(false); return; }
        throw err;
      }
      setAlreadyFunded(false);
      toast.success(`Subscribed to ${planName}!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      const display = msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
      setError(display);
      toast.error(display);
    } finally {
      setLoading(false);
      setLoadingLabel("Subscribe");
    }
  };

  const handleCancel = async () => {
    setError(null);
    setLoading(true);
    try {
      await onCancel();
      toast.success("Subscription cancelled.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      const display = msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
      setError(display);
      toast.error(display);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5 flex flex-col gap-4 transition-shadow hover:shadow-md",
        isSubscribed ? "border-[#4779FF]/30 bg-[#E8F0FE]/20" : "border-[#DADADA]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#4779FF]/10 flex items-center justify-center">
            <PlanIcon className="w-4 h-4 text-[#4779FF]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#030303]">{planName}</p>
            <p className="text-xs text-[#606060]">{planDesc || token.symbol}</p>
          </div>
        </div>
        {isSubscribed && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#E8F0FE] text-[#1967D2]">
            <Check className="w-3 h-3" />
            Subscribed
          </span>
        )}
        {isCancelling && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <XCircle className="w-3 h-3" />
            Cancelling
          </span>
        )}
      </div>

      <div className="rounded-lg bg-[#F9F9F9] p-3 text-center">
        <p className="text-2xl font-bold text-[#030303]">
          {amountFormatted}{" "}
          <span className="text-base font-medium text-[#606060]">{token.symbol}</span>
        </p>
        <p className="text-sm text-[#606060] mt-0.5">{periodLabel}</p>
      </div>

      <div className="space-y-1.5 text-xs text-[#606060]">
        <div className="flex justify-between">
          <span>Token</span>
          <span className="font-mono">{shortenAddress(mint)}</span>
        </div>
        <div className="flex justify-between">
          <span>Period</span>
          <span>{Number(periodHours)}h</span>
        </div>
        {metadataUri && metadataUri.startsWith("http") && (
          <div className="flex justify-between">
            <span>Metadata</span>
            <a href={metadataUri} target="_blank" rel="noopener noreferrer" className="text-[#4779FF] hover:underline truncate max-w-[120px]">
              View
            </a>
          </div>
        )}
        {!isActive && (
          <div className="flex justify-between text-amber-600">
            <span>Ends</span>
            <span>{new Date(Number(endTs) * 1000).toLocaleDateString()}</span>
          </div>
        )}
        {createdAt > 0n && (
          <div className="flex justify-between">
            <span>Created</span>
            <span>{new Date(Number(createdAt) * 1000).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {isSubscribed && (
        <button
          onClick={handleCancel}
          disabled={loading || disabled || !subscriptionPda}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-red-200 text-red-600 bg-white hover:bg-red-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel Subscription"}
        </button>
      )}

      {isCancelling && (
        <button
          onClick={onResume}
          disabled={loading || disabled}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-[#4779FF] text-[#4779FF] bg-white hover:bg-[#E8F0FE]"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4" /> Resume Subscription</>}
        </button>
      )}

      {!isSubscribed && !isCancelling && (
        <button
          onClick={handleSubscribe}
          disabled={loading || disabled}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-[#4779FF] text-white hover:bg-[#3366ee]"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{loadingLabel}</>
          ) : (
            <><Wallet className="w-4 h-4" />Subscribe</>
          )}
        </button>
      )}
    </div>
  );
}
