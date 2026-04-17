"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  getAvailableWalletProvidersData,
  connectAndVerifyWithWalletProvider,
  sendEmailOTP,
  verifyOTP,
  authenticateWithSocial,
  type WalletProviderData,
  type OTPVerification,
} from "@dynamic-labs-sdk/client";
import { exportWaasPrivateKey } from "@dynamic-labs-sdk/client/waas";
import { useWallet } from "@/lib/providers";
import { dynamicClient } from "@/lib/dynamic";
import { shortenAddress } from "@/lib/utils";
import { KeyRound } from "lucide-react";

// ---------------------------------------------------------------------------
// Inline icon components so we have no extra deps
// ---------------------------------------------------------------------------
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/>
      <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/>
      <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Shared button styles
// ---------------------------------------------------------------------------
const primaryBtn =
  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-[#4779FF] text-white hover:bg-[#3366ee] disabled:opacity-50 disabled:cursor-not-allowed";
const outlineBtn =
  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-white border border-[#DADADA] text-[#030303] hover:bg-[#F9F9F9] disabled:opacity-50 disabled:cursor-not-allowed";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function DynamicButton() {
  const { solanaAccount, loggedIn, disconnect, ensureSolanaWallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "email" | "otp" | "wallet" | "export">("menu");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerification, setOtpVerification] = useState<OTPVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const [exportPassword, setExportPassword] = useState("");
  const [exportRevealed, setExportRevealed] = useState(false);

  // Close dropdown on outside click
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
    setEmail("");
    setOtp("");
    setOtpVerification(null);
    setError(null);
    setLoading(false);
    setExportPassword("");
    setExportRevealed(false);
  };

  const handleExportKey = useCallback(async () => {
    if (!exportContainerRef.current || !solanaAccount) return;
    setLoading(true);
    setError(null);
    try {
      await exportWaasPrivateKey(
        { displayContainer: exportContainerRef.current, password: exportPassword, walletAccount: solanaAccount },
        dynamicClient
      );
      setExportRevealed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }, [exportPassword, solanaAccount]);

  // ── Email OTP ──────────────────────────────────────────────────────────────
  const handleSendOTP = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const verification = await sendEmailOTP({ email }, dynamicClient);
      setOtpVerification(verification);
      setView("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleVerifyOTP = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpVerification) return;
    setLoading(true);
    setError(null);
    try {
      await verifyOTP({ otpVerification, verificationToken: otp }, dynamicClient);
      await ensureSolanaWallet();
      setOpen(false);
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid code";
      if (msg.toLowerCase().includes("unauthorized")) {
        setError("Verification failed. Please request a new code and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [otpVerification, otp, ensureSolanaWallet]);

  // ── Google OAuth ───────────────────────────────────────────────────────────
  const handleGoogle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authenticateWithSocial(
        {
          provider: "google",
          redirectUrl: typeof window !== "undefined" ? window.location.href : "",
        },
        dynamicClient
      );
      // Page will redirect — no further action needed here
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }, []);

  // ── External wallet connect ────────────────────────────────────────────────
  const getSolanaProviders = (): WalletProviderData[] =>
    getAvailableWalletProvidersData(dynamicClient).filter((p) => p.chain === "SOL");

  const handleConnectWallet = useCallback(async (providerKey: string) => {
    setLoading(true);
    setError(null);
    try {
      await connectAndVerifyWithWalletProvider({ walletProviderKey: providerKey }, dynamicClient);
      await ensureSolanaWallet();
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }, [ensureSolanaWallet]);

  // ── Connected state ────────────────────────────────────────────────────────
  if (loggedIn && solanaAccount) {
    return (
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#DADADA] bg-white hover:bg-[#F9F9F9] transition-colors text-sm font-medium text-[#030303]"
        >
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white"
            style={{ background: "#4779FF" }}
          >
            {solanaAccount.address[0].toUpperCase()}
          </span>
          <span className="hidden sm:block font-mono text-xs text-[#606060]">
            {shortenAddress(solanaAccount.address)}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#606060" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>

        {open && (
          <div
            className={`absolute right-0 top-full mt-2 bg-white rounded-xl border border-[#DADADA] shadow-lg p-2 z-50 ${view === "export" ? "w-72" : "w-52"}`}
          >
            {view !== "export" && (
              <>
                <div className="px-3 py-2 mb-1">
                  <p className="text-xs text-[#606060] font-medium">Connected</p>
                  <p className="text-xs font-mono text-[#030303] truncate mt-0.5">
                    {solanaAccount.address}
                  </p>
                </div>
                <div className="border-t border-[#DADADA] my-1" />
                <button
                  onClick={() => { setView("export"); setError(null); }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-[#030303] hover:bg-[#F9F9F9] rounded-lg transition-colors"
                >
                  <KeyRound className="h-3.5 w-3.5 text-[#606060]" />
                  Export Private Key
                </button>
                <div className="border-t border-[#DADADA] my-1" />
                <button
                  onClick={() => { disconnect(); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              </>
            )}

            {view === "export" && (
              <div className="p-2 space-y-3">
                <button
                  type="button"
                  onClick={() => { setView("menu"); setError(null); setExportPassword(""); setExportRevealed(false); }}
                  className="flex items-center gap-1 text-xs text-[#606060] hover:text-[#030303] mb-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[#606060]" />
                  <p className="text-sm font-medium text-[#030303]">Export Private Key</p>
                </div>
                {!exportRevealed && (
                  <>
                    <input
                      type="password"
                      value={exportPassword}
                      onChange={(e) => setExportPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#4779FF]"
                      style={{ border: "1px solid #DADADA", background: "#F9F9F9" }}
                    />
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <button
                      onClick={handleExportKey}
                      disabled={loading}
                      className="w-full py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "#030303", color: "#fff" }}
                    >
                      {loading ? "Exporting…" : "Reveal Private Key"}
                    </button>
                  </>
                )}
                <div ref={exportContainerRef} className={exportRevealed ? "mt-2" : "hidden"} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen((o) => !o); setView("menu"); setError(null); }}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors"
      >
        Sign in
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-[#DADADA] shadow-lg p-4 z-50"
        >
          {/* ── Main menu ── */}
          {view === "menu" && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#030303] mb-3">Sign in to Kamino Earn</p>

              <button onClick={handleGoogle} disabled={loading} className={outlineBtn}>
                <GoogleIcon />
                Continue with Google
              </button>

              <button onClick={() => { setView("email"); setError(null); }} className={outlineBtn}>
                <EmailIcon />
                Continue with Email
              </button>

              {getSolanaProviders().length > 0 && (
                <>
                  <div className="flex items-center gap-2 my-1">
                    <div className="flex-1 h-px bg-[#DADADA]" />
                    <span className="text-xs text-[#606060]">or</span>
                    <div className="flex-1 h-px bg-[#DADADA]" />
                  </div>
                  <button onClick={() => { setView("wallet"); setError(null); }} className={outlineBtn}>
                    <WalletIcon />
                    Connect Wallet
                  </button>
                </>
              )}

              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>
          )}

          {/* ── Email form ── */}
          {view === "email" && (
            <form onSubmit={handleSendOTP} className="space-y-3">
              <button
                type="button"
                onClick={() => { setView("menu"); setError(null); }}
                className="flex items-center gap-1 text-xs text-[#606060] hover:text-[#030303] mb-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                Back
              </button>
              <p className="text-sm font-medium text-[#030303]">Enter your email</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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

          {/* ── OTP verification ── */}
          {view === "otp" && (
            <form onSubmit={handleVerifyOTP} className="space-y-3">
              <button
                type="button"
                onClick={() => { setView("email"); setError(null); }}
                className="flex items-center gap-1 text-xs text-[#606060] hover:text-[#030303] mb-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                Back
              </button>
              <p className="text-sm font-medium text-[#030303]">Enter the code</p>
              <p className="text-xs text-[#606060]">Sent to {email}</p>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
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

          {/* ── Wallet picker ── */}
          {view === "wallet" && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setView("menu"); setError(null); }}
                className="flex items-center gap-1 text-xs text-[#606060] hover:text-[#030303] mb-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                Back
              </button>
              <p className="text-sm font-medium text-[#030303] mb-3">Choose a Solana wallet</p>
              {getSolanaProviders().length === 0 ? (
                <p className="text-xs text-[#606060]">No Solana wallets detected. Install Phantom or another Solana wallet.</p>
              ) : (
                getSolanaProviders().map((provider) => (
                  <button
                    key={provider.key}
                    onClick={() => handleConnectWallet(provider.key)}
                    disabled={loading}
                    className={outlineBtn}
                  >
                    {provider.metadata.icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={provider.metadata.icon}
                        alt={provider.metadata.displayName}
                        width={20}
                        height={20}
                        className="rounded-sm shrink-0"
                      />
                    )}
                    {provider.metadata.displayName}
                  </button>
                ))
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
