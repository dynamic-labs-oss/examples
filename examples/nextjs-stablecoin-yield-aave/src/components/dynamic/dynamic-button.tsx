"use client";

import { useState, useRef, useEffect } from "react";
import {
  authenticateWithSocial,
  sendEmailOTP,
  verifyOTP,
  connectAndVerifyWithWalletProvider,
  getAvailableWalletProvidersData,
  getNetworksData,
  switchActiveNetwork,
  getActiveNetworkId,
} from "@dynamic-labs-sdk/client";
import { dynamicClient } from "@/lib/dynamic";
import { useWallet } from "@/lib/providers";

type AuthStep = "idle" | "menu" | "email" | "otp" | "wallets" | "networks";

export default function DynamicButton() {
  const { evmAccount, loggedIn, ensureEvmWallet, disconnect, setChainId } =
    useWallet();
  const [step, setStep] = useState<AuthStep>("idle");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerification, setOtpVerification] = useState<Awaited<
    ReturnType<typeof sendEmailOTP>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setStep("idle");
        setError(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (step !== "networks" || !evmAccount) return;
    getActiveNetworkId({ walletAccount: evmAccount }, dynamicClient)
      .then((result) => setActiveNetworkId(result.networkId))
      .catch(() => setActiveNetworkId(null));
  }, [step, evmAccount]);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      await authenticateWithSocial(
        { provider: "google", redirectUrl: globalThis.location.href },
        dynamicClient,
      );
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const verification = await sendEmailOTP({ email }, dynamicClient);
      setOtpVerification(verification);
      setStep("otp");
    } catch {
      setError("Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!otp || !otpVerification) return;
    setLoading(true);
    setError(null);
    try {
      await verifyOTP(
        { otpVerification, verificationToken: otp },
        dynamicClient,
      );
      await ensureEvmWallet();
      setStep("idle");
      setShowDropdown(false);
      setEmail("");
      setOtp("");
      setOtpVerification(null);
    } catch {
      setError("Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWallet = () => {
    setStep("wallets");
    setError(null);
  };

  const handleSelectWallet = async (providerKey: string) => {
    setLoading(true);
    setError(null);
    try {
      await connectAndVerifyWithWalletProvider(
        { walletProviderKey: providerKey },
        dynamicClient,
      );
      await ensureEvmWallet();
      setShowDropdown(false);
      setStep("idle");
    } catch {
      setError("Wallet connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loggedIn && evmAccount) {
    const addr = evmAccount.address;
    const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    const evmNetworks = getNetworksData(dynamicClient).filter(
      (n) => n.chain === "EVM",
    );
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => {
            setShowDropdown((v) => !v);
            setStep("idle");
          }}
          className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors"
          style={{
            borderColor: "#DADADA",
            color: "#030303",
            background: "#fff",
          }}
        >
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "#4779FF" }}
          >
            {addr.slice(2, 4).toUpperCase()}
          </span>
          {short}
        </button>
        {showDropdown && (
          <div
            className="absolute right-0 mt-1 rounded-xl shadow-lg border z-50 overflow-hidden"
            style={{
              borderColor: "#DADADA",
              background: "#fff",
              minWidth: "12rem",
            }}
          >
            {step !== "networks" ? (
              <>
                {evmNetworks.length > 0 && (
                  <button
                    onClick={() => setStep("networks")}
                    className="cursor-pointer w-full text-left px-4 py-3 text-sm transition-colors hover:bg-[#F9F9F9]"
                    style={{ color: "#606060" }}
                  >
                    Switch Network
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setStep("idle");
                    disconnect();
                  }}
                  className="cursor-pointer w-full text-left px-4 py-3 text-sm transition-colors hover:bg-[#F9F9F9]"
                  style={{ color: "#606060" }}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <div className="p-3 space-y-2" style={{ minWidth: "14rem" }}>
                <button
                  onClick={() => setStep("idle")}
                  className="cursor-pointer text-xs flex items-center gap-1 mb-1"
                  style={{ color: "#606060" }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  Back
                </button>
                <p
                  className="text-xs font-medium pb-1"
                  style={{ color: "#030303" }}
                >
                  Select network
                </p>
                {error && <p className="text-xs text-red-500">{error}</p>}
                {evmNetworks.map((n) => {
                  const isActive = activeNetworkId === n.networkId;
                  return (
                    <button
                      key={n.networkId}
                      disabled={loading}
                      onClick={async () => {
                        setLoading(true);
                        setError(null);
                        try {
                          await switchActiveNetwork(
                            {
                              networkId: n.networkId,
                              walletAccount: evmAccount,
                            },
                            dynamicClient,
                          );
                          setActiveNetworkId(n.networkId);
                          setChainId(Number(n.networkId));
                          setShowDropdown(false);
                          setStep("idle");
                        } catch {
                          setError("Failed to switch network.");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="cursor-pointer w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[#F0F0F0] disabled:opacity-50"
                      style={{
                        color: "#030303",
                        background: isActive ? "#F0F0F0" : "transparent",
                      }}
                    >
                      {n.iconUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={n.iconUrl}
                          alt={n.displayName}
                          width={16}
                          height={16}
                          className="rounded-full"
                        />
                      )}
                      <span className="flex-1 text-left">{n.displayName}</span>
                      {isActive && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="m20 6-11 11-5-5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setShowDropdown((v) => !v);
          setStep("menu");
          setError(null);
        }}
        className="cursor-pointer px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
        style={{ background: "#4779FF" }}
      >
        Sign in
      </button>

      {showDropdown && (
        <div
          className="absolute right-0 mt-1 w-72 rounded-xl shadow-lg border z-50 p-4 space-y-3"
          style={{ borderColor: "#DADADA", background: "#fff" }}
        >
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          {step === "menu" && (
            <>
              <button
                onClick={handleGoogleAuth}
                disabled={loading}
                className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors hover:bg-[#F9F9F9] disabled:opacity-50"
                style={{ borderColor: "#DADADA", color: "#030303" }}
              >
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
                Continue with Google
              </button>

              <button
                onClick={() => setStep("email")}
                className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors hover:bg-[#F9F9F9]"
                style={{ borderColor: "#DADADA", color: "#030303" }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                Continue with Email
              </button>

              <div className="border-t pt-3" style={{ borderColor: "#DADADA" }}>
                <button
                  onClick={handleConnectWallet}
                  disabled={loading}
                  className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors hover:bg-[#F9F9F9] disabled:opacity-50"
                  style={{ borderColor: "#DADADA", color: "#030303" }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                  </svg>
                  Connect EVM Wallet
                </button>
              </div>
            </>
          )}

          {step === "wallets" && (
            <>
              <button
                onClick={() => {
                  setStep("menu");
                  setError(null);
                }}
                className="cursor-pointer text-xs flex items-center gap-1"
                style={{ color: "#606060" }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back
              </button>
              <p className="text-xs font-medium" style={{ color: "#030303" }}>
                Choose a wallet
              </p>
              {getAvailableWalletProvidersData(dynamicClient)
                .filter((p) => p.chain === "EVM")
                .map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handleSelectWallet(p.key)}
                    disabled={loading}
                    className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors hover:bg-[#F9F9F9] disabled:opacity-50"
                    style={{ borderColor: "#DADADA", color: "#030303" }}
                  >
                    {p.metadata.icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.metadata.icon}
                        alt={p.metadata.displayName}
                        width={16}
                        height={16}
                        className="rounded"
                      />
                    )}
                    {p.metadata.displayName}
                  </button>
                ))}
            </>
          )}

          {step === "email" && (
            <>
              <button
                onClick={() => {
                  setStep("menu");
                  setError(null);
                }}
                className="cursor-pointer text-xs flex items-center gap-1"
                style={{ color: "#606060" }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back
              </button>
              <p className="text-xs font-medium" style={{ color: "#030303" }}>
                Enter your email
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-[#4779FF]/30"
                style={{ borderColor: "#DADADA", color: "#030303" }}
                onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
              />
              <button
                onClick={handleEmailSubmit}
                disabled={loading || !email}
                className="cursor-pointer w-full py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: "#4779FF" }}
              >
                {loading ? "Sending..." : "Send Code"}
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
                className="cursor-pointer text-xs flex items-center gap-1"
                style={{ color: "#606060" }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back
              </button>
              <p className="text-xs" style={{ color: "#606060" }}>
                Code sent to{" "}
                <span style={{ color: "#030303" }} className="font-medium">
                  {email}
                </span>
              </p>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-[#4779FF]/30 tracking-widest text-center"
                style={{ borderColor: "#DADADA", color: "#030303" }}
                onKeyDown={(e) => e.key === "Enter" && handleOtpSubmit()}
              />
              <button
                onClick={handleOtpSubmit}
                disabled={loading || otp.length < 6}
                className="cursor-pointer w-full py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: "#4779FF" }}
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
