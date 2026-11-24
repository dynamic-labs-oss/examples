"use client";

import { CheckCircle2, Clock, Loader2, Play, RefreshCw, Wallet } from "lucide-react";
import { useWallet } from "@/lib/useWallet";
import {
  useSolanaSubscriptions,
  type SolanaSubscription,
} from "@/lib/solana/useSolanaSubscriptions";
import { SOLANA_TOKEN_DECIMALS, SOLANA_TOKEN_SYMBOL, solanaAddressUrl } from "@/lib/solana/config";
import { formatDateTime, formatPlanPeriod } from "@/lib/solana/format";
import { formatTokenAmount, shortenAddress } from "@/lib/utils";

export function SolanaSubscriptions() {
  const { loggedIn } = useWallet();
  const {
    solanaAccount,
    subscriptions,
    loadingSubscriptions,
    cancelMutation,
    resumeMutation,
    collectMutation,
  } = useSolanaSubscriptions();

  const busy = cancelMutation.isPending || resumeMutation.isPending;

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#030303]">My Solana Subscriptions</h1>
          <p className="text-sm text-[#606060] mt-1">
            Subscriptions recorded on the Solana Subscriptions program from your wallet.
          </p>
        </div>
        <button
          onClick={() => collectMutation.mutate()}
          disabled={collectMutation.isPending || !solanaAccount}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-white border border-[#DADADA] text-[#030303] hover:bg-[#F9F9F9] disabled:opacity-50 transition-colors shrink-0"
        >
          {collectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Collect due pulls
        </button>
      </div>

      {!loggedIn && (
        <div className="rounded-xl border border-[#DADADA] bg-white p-10 flex flex-col items-center gap-3">
          <Wallet className="h-8 w-8 text-[#606060]" />
          <p className="text-sm text-[#606060]">Connect a wallet to view subscriptions.</p>
        </div>
      )}

      {loggedIn && loadingSubscriptions && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#606060]" />
        </div>
      )}

      {loggedIn && !loadingSubscriptions && subscriptions.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#DADADA] bg-white p-16 flex flex-col items-center gap-3">
          <RefreshCw className="h-10 w-10 text-[#030303]" />
          <h2 className="text-lg font-semibold text-[#030303]">No Solana subscriptions yet</h2>
          <p className="text-sm text-[#606060] text-center max-w-md">
            Head to the subscribe page, pick Solana and subscribe to a plan.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subscriptions.map((sub) => (
          <SolanaSubscriptionCard
            key={sub.address}
            sub={sub}
            busy={busy}
            onCancel={() => cancelMutation.mutate(sub)}
            onResume={() => resumeMutation.mutate(sub)}
          />
        ))}
      </div>
    </>
  );
}

function SolanaSubscriptionCard({
  sub,
  busy,
  onCancel,
  onResume,
}: {
  sub: SolanaSubscription;
  busy: boolean;
  onCancel: () => void;
  onResume: () => void;
}) {
  const { terms, expiresAtTs, currentPeriodStartTs, amountPulledInPeriod } = sub.data;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const cancelling = expiresAtTs > 0n;
  const ended = cancelling && nowSec >= expiresAtTs;
  const status = ended ? "ended" : cancelling ? "cancelling" : "active";
  const styles: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    cancelling: "bg-amber-50 text-amber-700 border-amber-200",
    ended: "bg-gray-50 text-gray-600 border-gray-200",
  };
  const periodSec = terms.periodHours * 3600n;
  const nextPeriodTs = currentPeriodStartTs + periodSec;
  const pulledThisPeriod = amountPulledInPeriod >= terms.amount && nowSec < nextPeriodTs;

  return (
    <div className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#4779FF]/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-[#4779FF]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#030303]">
              {formatTokenAmount(terms.amount, SOLANA_TOKEN_DECIMALS)} {SOLANA_TOKEN_SYMBOL}{" "}
              {formatPlanPeriod(terms.periodHours)}
            </p>
            <a
              href={solanaAddressUrl(sub.plan?.data.owner ?? (sub.data.header.delegatee as string))}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#606060] font-mono hover:text-[#4779FF]"
            >
              → {shortenAddress((sub.plan?.data.owner ?? sub.data.header.delegatee) as string)}
            </a>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${styles[status]}`}>
          {status}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-[#606060]">
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${pulledThisPeriod ? "text-green-600" : "text-[#606060]"}`} />
          <span>
            This period: {formatTokenAmount(amountPulledInPeriod, SOLANA_TOKEN_DECIMALS)} /{" "}
            {formatTokenAmount(terms.amount, SOLANA_TOKEN_DECIMALS)} {SOLANA_TOKEN_SYMBOL}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{cancelling ? (ended ? "Ended" : "Ends") : "Next period starts"}</span>
          <span>{formatDateTime(cancelling ? expiresAtTs : nextPeriodTs)}</span>
        </div>
      </div>

      {!ended && !cancelling && (
        <button
          onClick={onCancel}
          disabled={busy}
          className="w-full py-2.5 rounded-lg text-sm font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel subscription
        </button>
      )}
      {cancelling && !ended && (
        <button
          onClick={onResume}
          disabled={busy}
          className="w-full py-2.5 rounded-lg text-sm font-medium border border-[#DADADA] text-[#030303] bg-white hover:bg-[#F9F9F9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Resume subscription
        </button>
      )}
    </div>
  );
}
