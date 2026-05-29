"use client";

import { useState, useEffect, useCallback } from "react";
import {
  sendEmailOTP,
  verifyOTP,
  type OTPVerification,
  type WalletAccount,
} from "@dynamic-labs-sdk/client";
import { useUser, useWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { isSolanaWalletAccount } from "@dynamic-labs-sdk/solana";
import { dynamicClient } from "@/lib/dynamic";
import { ArrowRight, Banknote, Check, Copy, Globe, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { ChainSelector } from "./chain-selector";
import { CashPickupWidget } from "./cash-pickup-widget";
import { CHAINS, type MgChain } from "@/lib/chains";
import { fetchUsdcBalance } from "@/lib/balance";

function getAddressForChain(chain: MgChain, accounts: WalletAccount[]): string {
  if (chain === "solana")
    return accounts.find(isSolanaWalletAccount)?.address ?? "";
  return accounts.find(isEvmWalletAccount)?.address ?? "";
}

function truncate(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function RampApp() {
  const loggedIn = useUser() !== null;
  const walletAccounts = useWalletAccounts();
  const [selectedChain, setSelectedChain] = useState<MgChain>("base");
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerification, setOtpVerification] = useState<OTPVerification | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const address = getAddressForChain(selectedChain, walletAccounts);

  useEffect(() => {
    if (!address) {
      setUsdcBalance(null);
      return;
    }
    setUsdcBalance(null);
    fetchUsdcBalance(selectedChain, address).then(setUsdcBalance);
  }, [selectedChain, address]);

  const handleSendOtp = async () => {
    if (!email) return;
    setLoading(true);
    try {
      setOtpVerification(await sendEmailOTP({ email }, dynamicClient));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || !otpVerification) return;
    setLoading(true);
    try {
      await verifyOTP({ otpVerification, verificationToken: otp }, dynamicClient);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = useCallback(
    (amount: number) => {
      const sent = amount > 0 ? `$${amount.toFixed(2)} USDC` : "Funds";
      toast.success(`${sent} sent for cash pickup on ${CHAINS[selectedChain].name}`);
      if (address) fetchUsdcBalance(selectedChain, address).then(setUsdcBalance);
    },
    [selectedChain, address]
  );

  // ── Landing / Auth ──────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div className="bg-[rgb(249,249,249)] text-[#030303]">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-br from-[#4779FF]/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#4779FF]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative container mx-auto px-4 pt-20 pb-16 text-center">
            <h1 className="text-5xl sm:text-6xl font-bold mb-5 tracking-tight leading-[1.1] text-[#030303]">
              USDC to cash, <span className="text-[#4779FF]">anywhere</span>
            </h1>
            <p className="text-lg text-[#606060] mb-10 max-w-md mx-auto leading-relaxed">
              Off-ramp your USDC across Base, Ethereum, and Solana. Pick up cash
              at thousands of locations worldwide.
            </p>

            <div className="mx-auto max-w-xs bg-white border border-[#DADADA] rounded-2xl p-6 text-left space-y-3 shadow-sm">
              {otpVerification ? (
                <>
                  <p className="text-xs text-[#606060] text-center">
                    Code sent to <span className="text-[#030303]">{email}</span>
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                    className="w-full bg-[#F9F9F9] border border-[#DADADA] rounded-xl px-4 py-2.5 text-[#030303] placeholder-[#606060] text-sm text-center tracking-widest focus:outline-none focus:border-[#4779FF] transition-colors"
                    maxLength={6}
                  />
                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length < 6}
                    className="w-full flex items-center justify-center gap-2 bg-[#4779FF] hover:bg-[#3366ee] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition-all duration-200"
                  >
                    {loading ? "Verifying..." : "Verify"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      setOtpVerification(null);
                      setOtp("");
                    }}
                    className="w-full text-[#606060] hover:text-[#030303] text-xs text-center transition-colors py-1"
                  >
                    ← Back
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    className="w-full bg-[#F9F9F9] border border-[#DADADA] rounded-xl px-4 py-2.5 text-[#030303] placeholder-[#606060] text-sm focus:outline-none focus:border-[#4779FF] transition-colors"
                    suppressHydrationWarning
                  />
                  <button
                    onClick={handleSendOtp}
                    disabled={loading || !email}
                    className="w-full flex items-center justify-center gap-2 bg-[#4779FF] hover:bg-[#3366ee] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition-all duration-200"
                  >
                    {loading ? "Sending..." : "Get started"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-5 max-w-3xl mx-auto">
            {[
              {
                icon: Wallet,
                color: "#4779FF",
                title: "Embedded wallets",
                desc: "Non-custodial wallets created automatically — no extensions or seed phrases.",
              },
              {
                icon: Zap,
                color: "#7c3aed",
                title: "Multi-chain",
                desc: "Send USDC on Base, Ethereum, or Solana — switch chains anytime.",
              },
              {
                icon: Globe,
                color: "#0284c7",
                title: "Global pickup",
                desc: "Thousands of cash pickup locations across 200+ countries.",
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div
                key={title}
                className="bg-white border border-[#DADADA] rounded-2xl p-6 hover:shadow-sm transition-shadow"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${color}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="font-semibold text-[#030303] mb-1.5">{title}</h3>
                <p className="text-sm text-[#606060] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="max-w-lg mx-auto mt-20">
            <h2 className="text-2xl font-bold text-center mb-10 text-[#030303]">
              How it works
            </h2>
            <div className="relative space-y-0">
              {[
                {
                  step: "01",
                  title: "Sign in",
                  desc: "Authenticate with email — an embedded wallet is created automatically.",
                },
                {
                  step: "02",
                  title: "Choose your chain",
                  desc: "Select Base, Ethereum, or Solana — whichever holds your USDC.",
                },
                {
                  step: "03",
                  title: "Pick up cash",
                  desc: "Enter the amount, complete the flow, and collect cash at a nearby location.",
                },
              ].map(({ step, title, desc }, i) => (
                <div key={step} className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-[#4779FF]/10 border border-[#4779FF]/30 flex items-center justify-center shrink-0">
                      <span className="text-[#4779FF] text-xs font-bold">{step}</span>
                    </div>
                    {i < 2 && <div className="w-px h-10 bg-[#DADADA] mt-1" />}
                  </div>
                  <div className="pb-10">
                    <h4 className="font-semibold text-[#030303] mb-1">{title}</h4>
                    <p className="text-sm text-[#606060] leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Ramp UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[rgb(249,249,249)]">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-sm mx-auto space-y-5">
          <div>
            <h2 className="text-xl font-bold text-[#030303] mb-1">Off-ramp USDC</h2>
            <p className="text-sm text-[#606060]">
              Select a network and send USDC for cash pickup.
            </p>
          </div>

          <ChainSelector selected={selectedChain} onChange={setSelectedChain} />

          <div className="bg-white border border-[#DADADA] rounded-2xl p-6 space-y-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4779FF]/10 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-[#4779FF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#606060]">{CHAINS[selectedChain].name}</p>
                <p className="text-sm font-mono text-[#030303]">
                  {address ? (
                    truncate(address)
                  ) : (
                    <span className="text-[#DADADA]">No wallet</span>
                  )}
                </p>
              </div>
              {address && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1.5 rounded-lg text-[#606060] hover:text-[#030303] hover:bg-[#F9F9F9] transition-colors"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-[#4779FF]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            <div className="border-t border-[#DADADA] pt-4">
              <p className="text-xs text-[#606060] mb-1">USDC balance</p>
              <p className="text-3xl font-bold text-[#030303]">
                {usdcBalance === null ? (
                  <span className="text-[#DADADA] text-xl font-normal">Loading...</span>
                ) : (
                  <>${usdcBalance.toFixed(2)}</>
                )}
              </p>
            </div>

            <button
              onClick={() => setWidgetOpen(true)}
              disabled={!address || !usdcBalance}
              className="w-full flex items-center justify-center gap-2.5 bg-[#4779FF] hover:bg-[#3366ee] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-semibold transition-all duration-200"
            >
              <Banknote className="w-4 h-4" />
              Cash Pickup
            </button>
          </div>

          <p className="text-center text-xs text-[#606060]">
            USDC on {CHAINS[selectedChain].name} → cash at pickup locations worldwide
          </p>
        </div>
      </div>

      <CashPickupWidget
        open={widgetOpen}
        selectedChain={selectedChain}
        walletAccounts={walletAccounts}
        onClose={() => setWidgetOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
