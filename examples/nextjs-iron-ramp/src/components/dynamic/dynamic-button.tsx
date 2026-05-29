"use client";

import { useState } from "react";
import { useUser } from "@dynamic-labs-sdk/react-hooks";
import {
  logout,
  sendEmailOTP,
  signInWithSocialRedirect,
  verifyOTP,
  type OTPVerification,
} from "@dynamic-labs-sdk/client";
import { Loader2 } from "lucide-react";
import { dynamicClient } from "@/lib/dynamic";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export default function DynamicButton() {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerification, setOtpVerification] = useState<OTPVerification | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setEmail("");
    setOtp("");
    setOtpVerification(null);
    setError("");
  };

  const handleSendOtp = async () => {
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      setOtpVerification(await sendEmailOTP({ email }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!otpVerification || otp.length < 6) return;
    setLoading(true);
    setError("");
    try {
      await verifyOTP({ otpVerification, verificationToken: otp });
      setOpen(false);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithSocialRedirect({
        provider: "google",
        redirectUrl: window.location.origin,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    }
  };

  if (user) {
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => logout(dynamicClient)}
      >
        Sign out
      </Button>
    );
  }

  return (
    <>
      <Button className="w-full" onClick={() => setOpen(true)}>
        Log in or sign up
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{otpVerification ? "Enter code" : "Sign in"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!otpVerification ? (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogle}
                >
                  Continue with Google
                </Button>
                <div className="relative flex items-center">
                  <div className="flex-1 border-t" />
                  <span className="px-2 text-xs text-muted-foreground">or</span>
                  <div className="flex-1 border-t" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSendOtp}
                  disabled={loading || !email}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Code sent to {email}
                </p>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                />
                <Button
                  className="w-full"
                  onClick={handleVerify}
                  disabled={loading || otp.length < 6}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
                <button
                  className="w-full text-xs text-muted-foreground hover:underline cursor-pointer"
                  onClick={() => {
                    setOtpVerification(null);
                    setOtp("");
                  }}
                >
                  ← Use a different email
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
