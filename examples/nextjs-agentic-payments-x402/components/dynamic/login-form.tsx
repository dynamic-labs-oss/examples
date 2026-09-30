"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { sendEmailOTP, verifyOTP } from "@dynamic-labs-sdk/client";
import { dynamicClient } from "@/lib/dynamic-client";
import { useWallet } from "@/lib/providers";
import { Button } from "@/components/ui/button";

/**
 * Headless email one-time-code login (Dynamic JS SDK). No widget, no crypto
 * vocabulary — it reads like signing in to any app.
 */
export default function LoginForm() {
  const { ensureEvmWallet } = useWallet();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verification, setVerification] = useState<Awaited<
    ReturnType<typeof sendEmailOTP>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitEmail = async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      setVerification(await sendEmailOTP({ email }, dynamicClient));
      setStep("otp");
    } catch {
      setError("Couldn't send your code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    if (!code || !verification) return;
    setLoading(true);
    setError(null);
    try {
      await verifyOTP(
        { otpVerification: verification, verificationToken: code },
        dynamicClient
      );
      await ensureEvmWallet();
    } catch {
      setError("That code didn't match. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-dynamic";

  return (
    <div className="space-y-3">
      {step === "email" ? (
        <>
          <input
            type="email"
            inputMode="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitEmail()}
            className={inputClass}
          />
          <Button
            onClick={submitEmail}
            disabled={loading || !email}
            className="w-full bg-dynamic text-white hover:bg-dynamic/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Enter the code we sent to <span className="font-medium">{email}</span>.
          </p>
          <input
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitCode()}
            className={inputClass}
          />
          <Button
            onClick={submitCode}
            disabled={loading || !code}
            className="w-full bg-dynamic text-white hover:bg-dynamic/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </Button>
          <button
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Use a different email
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
