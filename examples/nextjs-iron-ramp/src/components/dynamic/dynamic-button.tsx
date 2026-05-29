"use client";

import { useState, useRef, useEffect } from "react";
import {
  useUser,
  useWalletAccounts,
  useInitStatus,
} from "@dynamic-labs-sdk/react-hooks";
import {
  signInWithSocialRedirect,
  logout,
  sendEmailOTP,
  verifyOTP,
  type OTPVerification,
} from "@dynamic-labs-sdk/client";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { isSolanaWalletAccount } from "@dynamic-labs-sdk/solana";
import { Check, ChevronLeft, Copy, Loader2, Mail } from "lucide-react";
import { dynamicClient } from "@/lib/dynamic";

type AuthStep = "menu" | "email" | "otp";

function truncate(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function truncateEmail(email: string, max = 22) {
  if (email.length <= max) return email;
  const [local, domain] = email.split("@");
  if (!domain) return `${email.slice(0, max - 1)}…`;
  const keep = Math.max(3, max - domain.length - 2);
  return `${local.slice(0, keep)}…@${domain}`;
}

function AddressRow({
  label,
  addr,
  copied,
  onCopy,
}: {
  label: string;
  addr: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-xs text-foreground">{truncate(addr)}</p>
      </div>
      <button
        onClick={onCopy}
        className="cursor-pointer p-1 rounded hover:bg-background text-muted-foreground"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

export default function DynamicButton() {
  const user = useUser();
  const accounts = useWalletAccounts();
  const initStatus = useInitStatus();
  const loggedIn = user !== null;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<AuthStep>("menu");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerification, setOtpVerification] = useState<OTPVerification | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setStep("menu");
        setError(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const evm = accounts.find(isEvmWalletAccount);
  const solana = accounts.find(isSolanaWalletAccount);

  const resetAuth = () => {
    setEmail("");
    setOtp("");
    setOtpVerification(null);
  };

  const copy = (addr: string, key: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithSocialRedirect(
        { provider: "google", redirectUrl: globalThis.location.origin },
        dynamicClient
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      setOtpVerification(await sendEmailOTP({ email }, dynamicClient));
      setStep("otp");
    } catch {
      setError("Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!otp || !otpVerification) return;
    setLoading(true);
    setError(null);
    try {
      await verifyOTP({ otpVerification, verificationToken: otp }, dynamicClient);
      setOpen(false);
      setStep("menu");
      resetAuth();
    } catch {
      setError("Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Initializing: gate the button until the SDK is ready ────────────────────
  if (initStatus !== "finished") {
    return (
      <button
        disabled
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-muted-foreground opacity-70"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </button>
    );
  }

  // ── Signed in: avatar + address → dropdown menu ─────────────────────────────
  if (loggedIn) {
    const primary = evm?.address ?? solana?.address ?? "";
    const email = user?.email ?? "";
    const label = email ? truncateEmail(email) : truncate(primary);
    const addrStart = primary.startsWith("0x") ? 2 : 0;
    const initials = (
      email ? email.slice(0, 2) : primary.slice(addrStart, 2)
    ).toUpperCase();
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
            {initials}
          </span>
          <span className="max-w-[180px] truncate">{label}</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-1 min-w-[16rem] rounded-xl border border-border bg-background shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Signed in as
              </p>
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email ?? "—"}
              </p>
            </div>
            <div className="p-2 space-y-1">
              {accounts.length === 0 ? (
                <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Setting up your wallets…
                </div>
              ) : (
                <>
                  {evm && (
                    <AddressRow
                      label="EVM"
                      addr={evm.address}
                      copied={copied === "evm"}
                      onCopy={() => copy(evm.address, "evm")}
                    />
                  )}
                  {solana && (
                    <AddressRow
                      label="Solana"
                      addr={solana.address}
                      copied={copied === "sol"}
                      onCopy={() => copy(solana.address, "sol")}
                    />
                  )}
                </>
              )}
            </div>
            <button
              onClick={() => {
                setOpen(false);
                logout(dynamicClient);
              }}
              className="cursor-pointer w-full text-left px-4 py-3 text-sm text-muted-foreground hover:bg-muted border-t border-border transition-colors"
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
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          setStep("menu");
          setError(null);
        }}
        className="cursor-pointer px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full"
      >
        Log in or sign up
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 rounded-xl border border-border bg-background shadow-lg z-50 p-4 space-y-3">
          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          {step === "menu" && (
            <>
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                {loading ? "Connecting…" : "Continue with Google"}
              </button>
              <button
                onClick={() => setStep("email")}
                disabled={loading}
                className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                Continue with Email
              </button>
            </>
          )}

          {step === "email" && (
            <>
              <button
                onClick={() => {
                  setStep("menu");
                  setError(null);
                }}
                className="cursor-pointer text-xs flex items-center gap-1 text-muted-foreground"
              >
                <ChevronLeft className="h-3 w-3" />
                Back
              </button>
              <p className="text-xs font-medium text-foreground">
                Enter your email
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-ring/30"
                onKeyDown={(e) => e.key === "Enter" && handleEmail()}
              />
              <button
                onClick={handleEmail}
                disabled={loading || !email}
                className="cursor-pointer w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Code
              </button>
            </>
          )}

          {step === "otp" && (
            <>
              <button
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
                className="cursor-pointer text-xs flex items-center gap-1 text-muted-foreground"
              >
                <ChevronLeft className="h-3 w-3" />
                Back
              </button>
              <p className="text-xs text-muted-foreground">
                Code sent to{" "}
                <span className="font-medium text-foreground">{email}</span>
              </p>
              <input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter 6-digit code"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground text-center tracking-widest outline-none focus:ring-2 focus:ring-ring/30"
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              />
              <button
                onClick={handleVerify}
                disabled={loading || otp.length < 6}
                className="cursor-pointer w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
