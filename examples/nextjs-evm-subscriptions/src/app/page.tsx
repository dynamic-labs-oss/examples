"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Loader2, ShieldCheck, Signature, Wallet } from "lucide-react";
import { useWallet } from "@/lib/useWallet";
import { useSubscriptions } from "@/lib/useSubscriptions";
import { CHAIN_NAME, MERCHANT_ADDRESS, PLAN, TOKEN_DECIMALS, TOKEN_SYMBOL } from "@/lib/config";
import { formatPeriod, formatTokenAmount, shortenAddress } from "@/lib/utils";
import { publicClient } from "@/lib/eip3009";
import { EIP3009_ABI, TOKEN_ADDRESS } from "@/lib/config";
import { useQuery } from "@tanstack/react-query";

export default function SubscribePage() {
  const [mounted, setMounted] = useState(false);
  const { evmAccount, loggedIn } = useWallet();
  const { subscribeMutation } = useSubscriptions();

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#030303]">EVM Subscriptions</h1>
        <p className="text-sm text-[#606060] mt-1">
          Sign once, then a relayer pulls {formatTokenAmount(PLAN.amount, TOKEN_DECIMALS)}{" "}
          {TOKEN_SYMBOL} {formatPeriod(PLAN.periodSeconds)} from your wallet — no
          on-chain transaction needed per payment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan card */}
        <div className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#4779FF]/10 flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-[#4779FF]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#030303]">{PLAN.name}</p>
              <p className="text-xs text-[#606060]">{CHAIN_NAME} · {TOKEN_SYMBOL}</p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-[#606060]">
            <div className="flex justify-between">
              <span>Amount</span>
              <span className="font-medium text-[#030303]">
                {formatTokenAmount(PLAN.amount, TOKEN_DECIMALS)} {TOKEN_SYMBOL}{" "}
                {formatPeriod(PLAN.periodSeconds)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Pulls authorized</span>
              <span className="font-medium text-[#030303]">{PLAN.pulls}</span>
            </div>
            <div className="flex justify-between">
              <span>Merchant</span>
              <span className="font-mono">
                {MERCHANT_ADDRESS ? shortenAddress(MERCHANT_ADDRESS) : "not configured"}
              </span>
            </div>
            {evmAccount && <UsdcBalance address={evmAccount.address as `0x${string}`} />}
          </div>

          <button
            onClick={() => subscribeMutation.mutate()}
            disabled={!loggedIn || !evmAccount || !MERCHANT_ADDRESS || subscribeMutation.isPending}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {subscribeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              `Sign ${PLAN.pulls} authorizations`
            )}
          </button>
          {!loggedIn && (
            <p className="text-xs text-center text-[#606060]">
              Connect an external wallet (MetaMask, WalletConnect…) or sign in to use an embedded wallet.
            </p>
          )}
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-4">
          <p className="text-sm font-semibold text-[#030303]">How it works</p>
          <Step
            icon={<Signature className="w-4 h-4 text-[#4779FF]" />}
            title="You sign {N} EIP-3009 authorizations"
            text={`Each signature lets the merchant pull ${formatTokenAmount(PLAN.amount, TOKEN_DECIMALS)} ${TOKEN_SYMBOL} once, inside its own ${formatPeriod(PLAN.periodSeconds)} window — the EVM equivalent of Solana's subscription delegation.`}
            n={PLAN.pulls}
          />
          <Step
            icon={<ShieldCheck className="w-4 h-4 text-[#4779FF]" />}
            title="Signatures are stored server-side"
            text="Authorizations live in Supabase. Each has a unique nonce and validity window enforced by the USDC contract itself, so a pull can't be replayed or taken early."
          />
          <Step
            icon={<Wallet className="w-4 h-4 text-[#4779FF]" />}
            title="A cron collects each period"
            text="Every hour the collector broadcasts transferWithAuthorization for the due authorization (or posts it to Relay /execute/permits where the route supports it). You never sign again — and you never pay gas."
          />
        </div>
      </div>
    </div>
  );
}

function Step({ icon, title, text, n }: { icon: React.ReactNode; title: string; text: string; n?: number }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-lg bg-[#4779FF]/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-[#030303]">
          {n !== undefined ? title.replace("{N}", String(n)) : title}
        </p>
        <p className="text-xs text-[#606060] mt-0.5">{text}</p>
      </div>
    </div>
  );
}

function UsdcBalance({ address }: { address: `0x${string}` }) {
  const { data } = useQuery({
    queryKey: ["usdc-balance", address],
    queryFn: () =>
      publicClient().readContract({
        address: TOKEN_ADDRESS,
        abi: EIP3009_ABI,
        functionName: "balanceOf",
        args: [address],
      }),
    refetchInterval: 15_000,
  });
  return (
    <div className="flex justify-between">
      <span>Your USDC balance</span>
      <span className="font-medium text-[#030303]">
        {data !== undefined ? formatTokenAmount(data, TOKEN_DECIMALS) : "…"} {TOKEN_SYMBOL}
      </span>
    </div>
  );
}
