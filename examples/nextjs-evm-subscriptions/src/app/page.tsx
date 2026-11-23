"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Loader2, ShieldCheck, Signature, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/useWallet";
import { useSubscriptions } from "@/lib/useSubscriptions";
import {
  CHAIN_NAME,
  MERCHANT_ADDRESS,
  PLAN,
  PLAN_CONTRACT,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
} from "@/lib/config";
import { ERC20_ABI, publicClient } from "@/lib/permit2";
import { formatPeriod, formatTokenAmount, shortenAddress } from "@/lib/utils";

// Matches the server-side cap in permit2-server.ts.
const MAX_PULLS = 52;

const PERIOD_UNITS: Record<number, string> = {
  60: "minute",
  3600: "hour",
  86400: "day",
  604800: "week",
  2592000: "month",
};

export default function SubscribePage() {
  const [mounted, setMounted] = useState(false);
  const { evmAccount, loggedIn } = useWallet();
  const { subscribeMutation } = useSubscriptions();
  // Open-ended: one unlimited, non-expiring Permit2 allowance; pulls continue
  // every period until the subscriber revokes it.
  const [openEnded, setOpenEnded] = useState(false);
  // Fixed mode: how many periods (e.g. hours) to sign up for. Kept as a string
  // so the field can be cleared while typing.
  const [pullsInput, setPullsInput] = useState(String(PLAN.pulls));

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const period = formatPeriod(PLAN.periodSeconds).replace(/^every /, "");
  const unit = PERIOD_UNITS[PLAN.periodSeconds] ?? "period";
  const pulls = Number(pullsInput);
  const pullsValid = Number.isInteger(pulls) && pulls >= 1 && pulls <= MAX_PULLS;
  const canSubmit = openEnded || pullsValid;
  const total = pullsValid ? PLAN.amount * BigInt(pulls) : 0n;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#030303]">EVM Subscriptions</h1>
        <p className="text-sm text-[#606060] mt-1">
          Sign once, then {formatTokenAmount(PLAN.amount, TOKEN_DECIMALS)} {TOKEN_SYMBOL} is pulled{" "}
          {formatPeriod(PLAN.periodSeconds)} from your wallet by a contract that enforces the schedule — no
          signature needed per payment.
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
              <span className="font-medium text-[#030303]">
                {openEnded ? "Until cancelled" : pullsValid ? pulls : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Merchant</span>
              <span className="font-mono">
                {MERCHANT_ADDRESS ? shortenAddress(MERCHANT_ADDRESS) : "not configured"}
              </span>
            </div>
            {evmAccount && <UsdcBalance address={evmAccount.address as `0x${string}`} />}
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#F4F4F4] text-xs font-medium">
            {(
              [
                [false, `Fixed ${unit}s`],
                [true, "Until cancelled"],
              ] as const
            ).map(([open, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setOpenEnded(open)}
                className={`py-1.5 rounded-md transition-colors ${
                  openEnded === open ? "bg-white text-[#030303] shadow-sm" : "text-[#606060] hover:text-[#030303]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {!openEnded && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pulls" className="text-xs font-medium text-[#030303]">
                How many {unit}s do you want to sign up for?
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="pulls"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_PULLS}
                  step={1}
                  value={pullsInput}
                  onChange={(e) => setPullsInput(e.target.value)}
                  className="w-24 rounded-lg border border-[#DADADA] px-3 py-1.5 text-sm text-[#030303] focus:outline-none focus:ring-2 focus:ring-[#4779FF]/40"
                />
                <span className="text-xs text-[#606060]">
                  {pullsValid
                    ? `${pulls} × ${formatTokenAmount(PLAN.amount, TOKEN_DECIMALS)} = ${formatTokenAmount(total, TOKEN_DECIMALS)} ${TOKEN_SYMBOL} total`
                    : `Enter a whole number from 1 to ${MAX_PULLS}`}
                </span>
              </div>
            </div>
          )}
          {openEnded && (
            <p className="text-xs text-[#606060] bg-[#F4F4F4] rounded-lg px-3 py-2">
              Your wallet will show an <span className="font-medium text-[#030303]">unlimited, non-expiring</span>{" "}
              USDC allowance. The plan contract can still only pay the merchant{" "}
              {formatTokenAmount(PLAN.amount, TOKEN_DECIMALS)} {TOKEN_SYMBOL} once per {period}, and you can
              revoke it any time with Cancel.
            </p>
          )}
          {!PLAN_CONTRACT && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Deploy the plan contract and set NEXT_PUBLIC_PLAN_CONTRACT to subscribe (see README).
            </p>
          )}

          <button
            onClick={() => subscribeMutation.mutate({ openEnded, pulls: pullsValid ? pulls : undefined })}
            disabled={
              !loggedIn ||
              !evmAccount ||
              !MERCHANT_ADDRESS ||
              !PLAN_CONTRACT ||
              !canSubmit ||
              subscribeMutation.isPending
            }
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {subscribeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : openEnded ? (
              "Sign once · until cancelled"
            ) : (
              `Sign once · ${pullsValid ? pulls : "…"} ${unit}${pulls === 1 ? "" : "s"}`
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
            title="You sign one Permit2 allowance"
            text={
              openEnded
                ? "One EIP-712 signature grants the plan contract an unlimited, non-expiring allowance. Pulls continue every period until you cancel. (The first time only, you also send a one-off USDC approve to Permit2 and pay its gas.)"
                : `One EIP-712 signature grants the plan contract up to ${formatTokenAmount(total, TOKEN_DECIMALS)} ${TOKEN_SYMBOL} (${pullsValid ? pulls : "your chosen number of"} ${unit}s), expiring after the last period. (The first time only, you also send a one-off USDC approve to Permit2 and pay its gas.)`
            }
          />
          <Step
            icon={<ShieldCheck className="w-4 h-4 text-[#4779FF]" />}
            title="The contract enforces the schedule"
            text={`The plan contract's merchant, amount and period are immutable, so it can only pay the merchant ${formatTokenAmount(PLAN.amount, TOKEN_DECIMALS)} ${TOKEN_SYMBOL} once per ${period}. Anyone can trigger a due pull — the money can only go one place.`}
          />
          <Step
            icon={<Wallet className="w-4 h-4 text-[#4779FF]" />}
            title="Cancel is a real on-chain revoke"
            text="Cancelling sends Permit2.approve(token, plan, 0, 0) from your wallet. After that no pull can succeed, whatever the server or database says."
          />
        </div>
      </div>
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

function UsdcBalance({ address }: { address: `0x${string}` }) {
  const { data } = useQuery({
    queryKey: ["usdc-balance", address],
    queryFn: () =>
      publicClient().readContract({
        address: TOKEN_ADDRESS,
        abi: ERC20_ABI,
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
