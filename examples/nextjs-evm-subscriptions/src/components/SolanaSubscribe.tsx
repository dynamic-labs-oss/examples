"use client";

import { CalendarClock, ExternalLink, Loader2, ShieldCheck, Signature, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { address } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { PlanWithAddress } from "@solana/subscriptions";
import { useWallet } from "@/lib/useWallet";
import { useSolanaSubscriptions } from "@/lib/solana/useSolanaSubscriptions";
import {
  SOLANA_CHAIN_NAME,
  SOLANA_MERCHANT_ADDRESS,
  SOLANA_TOKEN_DECIMALS,
  SOLANA_TOKEN_MINT,
  SOLANA_TOKEN_SYMBOL,
  solanaAddressUrl,
} from "@/lib/solana/config";
import { solanaRpc } from "@/lib/solana/rpc";
import { formatTokenAmount, shortenAddress } from "@/lib/utils";
import { formatPlanPeriod } from "@/lib/solana/format";

export function SolanaSubscribe() {
  const { loggedIn } = useWallet();
  const { solanaAccount, plans, loadingPlans, plansError, activePlanAddresses, subscribeMutation } =
    useSolanaSubscriptions();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#030303]">Solana Subscriptions</h1>
        <p className="text-sm text-[#606060] mt-1">
          Subscribe once and the merchant can pull each period&apos;s payment from your wallet — the
          on-chain Subscriptions program caps it at the plan amount per period.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          {!SOLANA_MERCHANT_ADDRESS && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Set NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS and create a plan with{" "}
              <code>npm run solana:create-plan</code> (see README).
            </p>
          )}

          {loadingPlans && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#606060]" />
            </div>
          )}
          {plansError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
              Couldn&apos;t load plans: {plansError instanceof Error ? plansError.message : "unknown error"}
            </p>
          )}
          {SOLANA_MERCHANT_ADDRESS && !loadingPlans && !plansError && plans.length === 0 && (
            <p className="text-sm text-[#606060] rounded-xl border border-dashed border-[#DADADA] bg-white p-6">
              No active {SOLANA_TOKEN_SYMBOL} plans for this merchant yet. Create one with{" "}
              <code>npm run solana:create-plan</code>.
            </p>
          )}

          {plans.map((plan) => (
            <PlanCard
              key={plan.address}
              plan={plan}
              subscribed={activePlanAddresses.has(plan.address as string)}
              canSubscribe={loggedIn && !!solanaAccount && !subscribeMutation.isPending}
              pending={subscribeMutation.isPending && subscribeMutation.variables?.address === plan.address}
              onSubscribe={() => subscribeMutation.mutate(plan)}
              balance={solanaAccount ? <TokenBalance owner={solanaAccount.address} /> : null}
            />
          ))}
          {!loggedIn && plans.length > 0 && (
            <p className="text-xs text-center text-[#606060]">
              Sign in (email, Google or a Solana wallet) to subscribe.
            </p>
          )}
          {loggedIn && !solanaAccount && (
            <p className="text-xs text-center text-[#606060]">
              No Solana wallet on this account yet — one is created automatically for embedded wallets. If
              you connected an EVM-only wallet, sign in with email or Google (or a Solana wallet) instead.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-4">
          <p className="text-sm font-semibold text-[#030303]">How it works</p>
          <Step
            icon={<Signature className="w-4 h-4 text-[#4779FF]" />}
            title="You subscribe in one transaction"
            text="The first time, it also creates your subscription authority (a PDA that can move your USDC only for plans you join). Then it records a subscription with the plan's exact terms."
          />
          <Step
            icon={<ShieldCheck className="w-4 h-4 text-[#4779FF]" />}
            title="The program enforces the cap"
            text="The merchant can pull at most the plan amount per period, only to the plan's destination. Terms you saw are checked on-chain, so a plan can't change under you."
          />
          <Step
            icon={<Wallet className="w-4 h-4 text-[#4779FF]" />}
            title="Cancel any time"
            text="Cancelling queues expiry at the end of the current period; you can resume until then. Pulls are collected hourly, or on demand with the Collect button."
          />
          <p className="text-xs text-[#606060]">
            You need a little {SOLANA_CHAIN_NAME} SOL for fees (
            <a className="text-[#4779FF] hover:underline" href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer">faucet.solana.com</a>
            ) and {SOLANA_TOKEN_SYMBOL} (
            <a className="text-[#4779FF] hover:underline" href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">faucet.circle.com</a>
            ).
          </p>
        </div>
      </div>
    </>
  );
}

function PlanCard({
  plan,
  subscribed,
  canSubscribe,
  pending,
  onSubscribe,
  balance,
}: {
  plan: PlanWithAddress;
  subscribed: boolean;
  canSubscribe: boolean;
  pending: boolean;
  onSubscribe: () => void;
  balance: React.ReactNode;
}) {
  const { terms } = plan.data.data;
  return (
    <div className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#4779FF]/10 flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-[#4779FF]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#030303]">
            {formatTokenAmount(terms.amount, SOLANA_TOKEN_DECIMALS)} {SOLANA_TOKEN_SYMBOL}{" "}
            {formatPlanPeriod(terms.periodHours)}
          </p>
          <p className="text-xs text-[#606060]">{SOLANA_CHAIN_NAME} · plan #{plan.data.data.planId.toString().slice(-6)}</p>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-[#606060]">
        <div className="flex justify-between">
          <span>Merchant</span>
          <a
            href={solanaAddressUrl(plan.data.owner as string)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono inline-flex items-center gap-1 hover:text-[#4779FF]"
          >
            {shortenAddress(plan.data.owner as string)} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {balance}
      </div>
      <button
        onClick={onSubscribe}
        disabled={!canSubscribe || subscribed}
        className="w-full py-2.5 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : subscribed ? "Subscribed" : "Subscribe"}
      </button>
    </div>
  );
}

function TokenBalance({ owner }: { owner: string }) {
  const { data } = useQuery({
    queryKey: ["solana-balance", owner],
    queryFn: async () => {
      const [ata] = await findAssociatedTokenPda({
        mint: address(SOLANA_TOKEN_MINT),
        owner: address(owner),
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      try {
        return BigInt((await solanaRpc().getTokenAccountBalance(ata).send()).value.amount);
      } catch {
        return 0n; // no token account yet
      }
    },
    refetchInterval: 15_000,
    staleTime: 0,
  });
  return (
    <div className="flex justify-between">
      <span>Your {SOLANA_TOKEN_SYMBOL} balance</span>
      <span className="font-medium text-[#030303]">
        {data !== undefined ? formatTokenAmount(data, SOLANA_TOKEN_DECIMALS) : "…"} {SOLANA_TOKEN_SYMBOL}
      </span>
    </div>
  );
}

function Step({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-lg bg-[#4779FF]/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-[#030303]">{title}</p>
        <p className="text-xs text-[#606060] mt-0.5">{text}</p>
      </div>
    </div>
  );
}
