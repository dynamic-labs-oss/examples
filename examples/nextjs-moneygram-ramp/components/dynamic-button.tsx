"use client";

import { dynamicClient } from "@/lib/dynamic";
import {
  logout,
  sendEmailOTP,
  signInWithSocialRedirect,
  verifyOTP,
  type OTPVerification,
} from "@dynamic-labs-sdk/client";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { useUser, useWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { isSolanaWalletAccount } from "@dynamic-labs-sdk/solana";
import { useCallback, useEffect, useRef, useState } from "react";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function truncate(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function truncateEmail(email: string, max = 22): string {
  if (email.length <= max) return email;
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return `${email.slice(0, max - 1)}…`;
  const keep = Math.max(3, max - domain.length - 2);
  return `${local.slice(0, keep)}…@${domain}`;
}

const primaryBtn =
  "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-[#4779FF] text-white hover:bg-[#3366ee] disabled:opacity-50 disabled:cursor-not-allowed";
const outlineBtn =
  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-white border border-[#DADADA] text-[#030303] hover:bg-[#F9F9F9] disabled:opacity-50 disabled:cursor-not-allowed";

export default function DynamicButton() {
  const user = useUser();
  const accounts = useWalletAccounts();
  const loggedIn = user !== null;
  const email = user?.email ?? null;
  const evmAccount = accounts.find(isEvmWalletAccount) ?? null;
  const solanaAccount = accounts.find(isSolanaWalletAccount) ?? null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "email" | "otp">("menu");
  const [emailInput, setEmailInput] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerification, setOtpVerification] = useState<OTPVerification | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setView("menu");
        setError(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const reset = () => {
    setView("menu");
    setEmailInput("");
    setOtp("");
    setOtpVerification(null);
    setError(null);
    setLoading(false);
  };

  const handleGoogle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithSocialRedirect(
        { provider: "google", redirectUrl: globalThis.location.origin },
        dynamicClient
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }, []);

  const handleSendOTP = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      try {
        setOtpVerification(await sendEmailOTP({ email: emailInput }, dynamicClient));
        setView("otp");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send code");
      } finally {
        setLoading(false);
      }
    },
    [emailInput]
  );

  const handleVerifyOTP = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!otpVerification) return;
      setLoading(true);
      setError(null);
      try {
        await verifyOTP({ otpVerification, verificationToken: otp }, dynamicClient);
        setOpen(false);
        reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid code");
      } finally {
        setLoading(false);
      }
    },
    [otpVerification, otp]
  );

  const copy = (addr: string, key: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Signed in: avatar + email → dropdown ────────────────────────────────────
  if (loggedIn) {
    const label = email ? truncateEmail(email) : truncate(evmAccount?.address ?? "");
    const initial = (email?.[0] ?? evmAccount?.address?.[2] ?? "?").toUpperCase();
    return (
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#DADADA] bg-white hover:bg-[#F9F9F9] transition-colors text-sm font-medium text-[#030303]"
        >
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-[#4779FF]">
            {initial}
          </span>
          <span className="hidden sm:block max-w-[180px] truncate text-[#606060]">
            {label}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#606060" strokeWidth="2">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-[#DADADA] shadow-lg p-2 z-50">
            <div className="px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[#606060]">
                Signed in as
              </p>
              <p className="text-sm font-medium text-[#030303] truncate">
                {email ?? "—"}
              </p>
            </div>
            <div className="border-t border-[#DADADA] my-1" />
            {evmAccount && (
              <AddressRow
                label="EVM"
                addr={evmAccount.address}
                copied={copied === "evm"}
                onCopy={() => copy(evmAccount.address, "evm")}
              />
            )}
            {solanaAccount && (
              <AddressRow
                label="Solana"
                addr={solanaAccount.address}
                copied={copied === "sol"}
                onCopy={() => copy(solanaAccount.address, "sol")}
              />
            )}
            <div className="border-t border-[#DADADA] my-1" />
            <button
              onClick={() => {
                logout(dynamicClient);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Signed out: Sign in → dropdown (Google / email → OTP) ───────────────────
  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          setView("menu");
          setError(null);
        }}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors"
      >
        Sign in
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-[#DADADA] shadow-lg p-4 z-50">
          {view === "menu" && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#030303] mb-3">
                Sign in to Cash Pickup
              </p>
              <button onClick={handleGoogle} disabled={loading} className={outlineBtn}>
                <GoogleIcon />
                {loading ? "Connecting…" : "Continue with Google"}
              </button>
              <button
                onClick={() => {
                  setView("email");
                  setError(null);
                }}
                className={outlineBtn}
              >
                <EmailIcon />
                Continue with Email
              </button>
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>
          )}
          {view === "email" && (
            <form onSubmit={handleSendOTP} className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setView("menu");
                  setError(null);
                }}
                className="flex items-center gap-1 text-xs text-[#606060] hover:text-[#030303] mb-1"
              >
                <BackIcon />
                Back
              </button>
              <p className="text-sm font-medium text-[#030303]">Enter your email</p>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] focus:ring-1 focus:ring-[#4779FF]/30 text-[#030303]"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? "Sending…" : "Send code"}
              </button>
            </form>
          )}
          {view === "otp" && (
            <form onSubmit={handleVerifyOTP} className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setView("email");
                  setError(null);
                }}
                className="flex items-center gap-1 text-xs text-[#606060] hover:text-[#030303] mb-1"
              >
                <BackIcon />
                Back
              </button>
              <p className="text-sm font-medium text-[#030303]">Enter the code</p>
              <p className="text-xs text-[#606060]">Sent to {emailInput}</p>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                required
                maxLength={6}
                className="w-full px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] focus:ring-1 focus:ring-[#4779FF]/30 text-[#030303] tracking-widest text-center"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? "Verifying…" : "Verify"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function AddressRow({
  label,
  addr,
  copied,
  onCopy,
}: Readonly<{
  label: string;
  addr: string;
  copied: boolean;
  onCopy: () => void;
}>) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-[#F9F9F9]">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-[#606060]">{label}</p>
        <p className="font-mono text-xs text-[#030303]">{truncate(addr)}</p>
      </div>
      <button onClick={onCopy} className="p-1 rounded text-[#606060] hover:text-[#030303]">
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4779FF" strokeWidth="2.5">
            <path d="m20 6-11 11-5-5" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}
