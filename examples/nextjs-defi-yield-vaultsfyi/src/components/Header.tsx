"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import {
  authenticateWithSocial,
  sendEmailOTP,
  verifyOTP,
  getNetworksData,
  switchActiveNetwork,
} from "@dynamic-labs-sdk/client";
import { dynamicClient } from "@/lib/dynamic";
import { useWallet } from "@/lib/providers";
import { shortAddress } from "@/lib/utils";

/**
 * Minimal Dynamic auth header. Three sign-in paths are wired:
 *   1. Continue with Google → social OAuth (full redirect cycle handled in
 *      providers.tsx via detectOAuthRedirect / completeSocialAuthentication)
 *   2. Continue with Email → email + OTP, calls ensureEvmWallet on success
 *   3. (Inherited) external EVM wallet — not surfaced in this minimal UI;
 *      see dynamic-labs-oss/examples/nextjs-defi-lending-morpho's
 *      DynamicButton.tsx for the full multi-step modal pattern.
 *
 * Network switcher mirrors the morpho example's pattern: read available
 * EVM networks via getNetworksData and switch via switchActiveNetwork.
 */
export default function Header() {
  const { evmAccount, loggedIn, chainId, setChainId, ensureEvmWallet, disconnect } =
    useWallet();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "email" | "otp">("menu");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerification, setOtpVerification] = useState<Awaited<
    ReturnType<typeof sendEmailOTP>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(() => {
    if (!evmAccount) return;
    navigator.clipboard.writeText(evmAccount.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [evmAccount]);

  const evmNetworks = loggedIn
    ? getNetworksData(dynamicClient).filter((n) => n.chain === "EVM")
    : [];

  async function handleGoogle() {
    setBusy(true);
    setErr(null);
    try {
      await authenticateWithSocial(
        { provider: "google", redirectUrl: globalThis.location.href },
        dynamicClient,
      );
    } catch {
      setErr("Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail() {
    if (!email) return;
    setBusy(true);
    setErr(null);
    try {
      const verification = await sendEmailOTP({ email }, dynamicClient);
      setOtpVerification(verification);
      setMode("otp");
    } catch {
      setErr("Failed to send code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!otp || !otpVerification) return;
    setBusy(true);
    setErr(null);
    try {
      await verifyOTP(
        { otpVerification, verificationToken: otp },
        dynamicClient,
      );
      await ensureEvmWallet();
      setOpen(false);
      setMode("menu");
      setEmail("");
      setOtp("");
      setOtpVerification(null);
    } catch {
      setErr("Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSwitchNetwork(networkId: string) {
    if (!evmAccount) return;
    try {
      await switchActiveNetwork(
        { networkId, walletAccount: evmAccount },
        dynamicClient,
      );
      setChainId(Number(networkId));
    } catch {
      setErr("Failed to switch network.");
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#DADADA]">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <h1 className="text-base font-semibold">vaults.fyi × Dynamic</h1>
        <div className="relative">
          {loggedIn && evmAccount ? (
            <div className="flex items-center gap-2">
              {evmNetworks.length > 0 && (
                <select
                  value={chainId}
                  onChange={(e) => handleSwitchNetwork(e.target.value)}
                  className="text-xs border border-[#DADADA] rounded px-2 py-1 bg-white"
                >
                  {evmNetworks.map((n) => (
                    <option key={n.networkId} value={n.networkId}>
                      {n.displayName}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={copyAddress}
                title="Copy address"
                className="text-xs px-3 py-1.5 rounded border border-[#DADADA] hover:bg-[#F9F9F9] inline-flex items-center gap-1.5"
              >
                {shortAddress(evmAccount.address)}
                {copied ? (
                  <Check className="w-3 h-3 text-green-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={() => disconnect()}
                className="text-xs px-3 py-1.5 rounded border border-[#DADADA] hover:bg-[#F9F9F9]"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setOpen((v) => !v);
                  setMode("menu");
                  setErr(null);
                }}
                className="text-sm px-4 py-2 rounded text-white bg-[#4779FF] hover:bg-[#3a66e0]"
              >
                Sign in
              </button>
              {open && (
                <div
                  className="absolute right-0 mt-2 w-72 rounded-xl shadow-lg border border-[#DADADA] bg-white p-4 space-y-3 z-50"
                >
                  {err && (
                    <p className="text-xs text-red-600 text-center">{err}</p>
                  )}
                  {mode === "menu" && (
                    <>
                      <button
                        onClick={handleGoogle}
                        disabled={busy}
                        className="w-full text-sm py-2 rounded border border-[#DADADA] hover:bg-[#F9F9F9] disabled:opacity-50"
                      >
                        Continue with Google
                      </button>
                      <button
                        onClick={() => setMode("email")}
                        className="w-full text-sm py-2 rounded border border-[#DADADA] hover:bg-[#F9F9F9]"
                      >
                        Continue with Email
                      </button>
                    </>
                  )}
                  {mode === "email" && (
                    <>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3 py-2 text-sm rounded border border-[#DADADA] outline-none focus:ring-2 focus:ring-[#4779FF]/30"
                        onKeyDown={(e) => e.key === "Enter" && handleEmail()}
                      />
                      <button
                        onClick={handleEmail}
                        disabled={busy || !email}
                        className="w-full text-sm py-2 rounded text-white bg-[#4779FF] hover:bg-[#3a66e0] disabled:opacity-50"
                      >
                        {busy ? "Sending…" : "Send code"}
                      </button>
                    </>
                  )}
                  {mode === "otp" && (
                    <>
                      <p className="text-xs text-[#606060] text-center">
                        Code sent to <b>{email}</b>
                      </p>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="6-digit code"
                        maxLength={6}
                        className="w-full px-3 py-2 text-sm tracking-widest text-center rounded border border-[#DADADA] outline-none focus:ring-2 focus:ring-[#4779FF]/30"
                        onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                      />
                      <button
                        onClick={handleVerify}
                        disabled={busy || otp.length < 6}
                        className="w-full text-sm py-2 rounded text-white bg-[#4779FF] hover:bg-[#3a66e0] disabled:opacity-50"
                      >
                        {busy ? "Verifying…" : "Verify"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
