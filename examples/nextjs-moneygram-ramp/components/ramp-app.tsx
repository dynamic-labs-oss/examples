"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isSignedIn,
  sendEmailOTP,
  verifyOTP,
  getWalletAccounts,
  onEvent,
  type OTPVerification,
} from "@dynamic-labs-sdk/client";
import { createWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";
import { initDynamic, dynamicClient } from "@/lib/dynamic";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { isSolanaWalletAccount } from "@dynamic-labs-sdk/solana";
import type { WalletAccount } from "@dynamic-labs-sdk/client";
import { ArrowRight, Banknote, Check, Copy, Globe, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { ChainSelector } from "./chain-selector";
import { CashPickupWidget } from "./cash-pickup-widget";
import { CHAINS, type MgChain } from "@/lib/chains";
import { fetchUsdcBalance } from "@/lib/balance";

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAddressForChain(chain: MgChain, accounts: WalletAccount[]): string {
  if (chain === "solana") return accounts.find(isSolanaWalletAccount)?.address ?? "";
  return accounts.find(isEvmWalletAccount)?.address ?? "";
}

function truncate(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function RampApp() {
  const [signedIn, setSignedIn] = useState(false);
  const [walletAccounts, setWalletAccounts] = useState<WalletAccount[]>([]);
  const [selectedChain, setSelectedChain] = useState<MgChain>("base");
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerification, setOtpVerification] = useState<OTPVerification | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let unsubToken: (() => void) | undefined;
    let unsubWallets: (() => void) | undefined;
    initDynamic().then(async () => {
      if (isSignedIn()) {
        const existing = getWalletAccounts();
        if (existing.length === 0) {
          await createWaasWalletAccounts({ chains: ["EVM", "SOL"] }, dynamicClient);
        }
        setSignedIn(true);
        setWalletAccounts(getWalletAccounts());
      }
      unsubToken = onEvent(
        { event: "tokenChanged", listener: ({ token }) => {
          setSignedIn(!!token);
          if (!token) setWalletAccounts([]);
        }},
        dynamicClient,
      );
      unsubWallets = onEvent(
        { event: "walletAccountsChanged", listener: ({ walletAccounts }) => setWalletAccounts(walletAccounts) },
        dynamicClient,
      );
    });
    return () => {
      unsubToken?.();
      unsubWallets?.();
    };
  }, []);

  const address = getAddressForChain(selectedChain, walletAccounts);

  useEffect(() => {
    if (!address) { setUsdcBalance(null); return; }
    setUsdcBalance(null);
    fetchUsdcBalance(selectedChain, address).then(setUsdcBalance);
  }, [selectedChain, address]);

  const handleSendOtp = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const verification = await sendEmailOTP({ email });
      setOtpVerification(verification);
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
      await verifyOTP({ otpVerification, verificationToken: otp });
      if (getWalletAccounts().length === 0) {
        await createWaasWalletAccounts({ chains: ["EVM", "SOL"] }, dynamicClient);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = useCallback((amount: number) => {
    toast.success(`${amount > 0 ? `$${amount.toFixed(2)} USDC` : "Funds"} sent for cash pickup on ${CHAINS[selectedChain].name}`);
    if (address) fetchUsdcBalance(selectedChain, address).then(setUsdcBalance);
  }, [selectedChain, address]);

  // ── Landing / Auth ──────────────────────────────────────────────────────────

  if (!signedIn) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Hero */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-br from-teal-950/40 via-gray-950 to-gray-950 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative container mx-auto px-4 pt-20 pb-16 text-center">
            <h1 className="text-5xl sm:text-6xl font-bold mb-5 tracking-tight leading-[1.1]">
              USDC to cash,{" "}
              <span className="bg-linear-to-r from-teal-400 to-teal-600 bg-clip-text text-transparent">
                anywhere
              </span>
            </h1>
            <p className="text-lg text-gray-400 mb-10 max-w-md mx-auto leading-relaxed">
              Off-ramp your USDC across Base, Ethereum, and Solana. Pick up
              cash at thousands of locations worldwide.
            </p>

            {/* Auth card */}
            <div className="mx-auto max-w-xs bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left space-y-3">
              {!otpVerification ? (
                <>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-teal-600 transition-colors"
                    suppressHydrationWarning
                  />
                  <button
                    onClick={handleSendOtp}
                    disabled={loading || !email}
                    className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/25"
                  >
                    {loading ? "Sending..." : "Get started"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500 text-center">
                    Code sent to <span className="text-gray-300">{email}</span>
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm text-center tracking-widest focus:outline-none focus:border-teal-600 transition-colors"
                    maxLength={6}
                  />
                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length < 6}
                    className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition-all duration-200"
                  >
                    {loading ? "Verifying..." : "Verify"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setOtpVerification(null); setOtp(""); }}
                    className="w-full text-gray-500 hover:text-gray-300 text-xs text-center transition-colors py-1"
                  >
                    ← Back
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-5 max-w-3xl mx-auto">
            {[
              {
                icon: Wallet,
                color: "teal",
                title: "Embedded wallets",
                desc: "Non-custodial wallets created automatically — no extensions or seed phrases.",
              },
              {
                icon: Zap,
                color: "purple",
                title: "Multi-chain",
                desc: "Send USDC on Base, Ethereum, or Solana — switch chains anytime.",
              },
              {
                icon: Globe,
                color: "blue",
                title: "Global pickup",
                desc: "Thousands of cash pickup locations across 200+ countries.",
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div
                key={title}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                    color === "teal" ? "bg-teal-500/10" : color === "purple" ? "bg-purple-500/10" : "bg-blue-500/10"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      color === "teal" ? "text-teal-400" : color === "purple" ? "text-purple-400" : "text-blue-400"
                    }`}
                  />
                </div>
                <h3 className="font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="max-w-lg mx-auto mt-20">
            <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
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
                    <div className="w-9 h-9 rounded-full bg-teal-600/20 border border-teal-600/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-teal-400 text-xs font-bold">{step}</span>
                    </div>
                    {i < 2 && <div className="w-px h-10 bg-gray-800 mt-1" />}
                  </div>
                  <div className="pb-10">
                    <h4 className="font-semibold text-white mb-1">{title}</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
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
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-sm mx-auto space-y-5">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Off-ramp USDC</h2>
            <p className="text-sm text-gray-500">
              Select a network and send USDC for cash pickup.
            </p>
          </div>

          <ChainSelector selected={selectedChain} onChange={setSelectedChain} />

          {/* Wallet card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5 hover:border-gray-700 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-5 h-5 text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">{CHAINS[selectedChain].name}</p>
                <p className="text-sm font-mono text-white">
                  {address ? truncate(address) : <span className="text-gray-600">No wallet</span>}
                </p>
              </div>
              {address && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                  title="Copy address"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            <div className="border-t border-gray-800 pt-4">
              <p className="text-xs text-gray-500 mb-1">USDC balance</p>
              <p className="text-3xl font-bold text-white">
                {usdcBalance === null ? (
                  <span className="text-gray-700 text-xl font-normal">Loading...</span>
                ) : (
                  <>${usdcBalance.toFixed(2)}</>
                )}
              </p>
            </div>

            <button
              onClick={() => setWidgetOpen(true)}
              disabled={!address || !usdcBalance}
              className="w-full flex items-center justify-center gap-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/25"
            >
              <Banknote className="w-4 h-4" />
              Cash Pickup
            </button>
          </div>

          <p className="text-center text-xs text-gray-600">
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
