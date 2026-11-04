"use client";

import { useState } from "react";
import { useSendEmailOTP, useVerifyOTP } from "@dynamic-labs-sdk/react-hooks";

// The JS SDK is headless: there is no built-in modal, so the login UI is ours.
export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const {
    mutate: sendEmailOTP,
    data: otpVerification,
    isPending: sending,
    error: sendError,
    reset: resetSend,
  } = useSendEmailOTP();
  const { mutate: verifyOTP, isPending: verifying, error: verifyError } =
    useVerifyOTP();

  const error = sendError ?? verifyError;

  if (!otpVerification) {
    return (
      <form
        className="mx-auto flex w-full max-w-sm flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          sendEmailOTP({ email });
        }}
      >
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-lg border border-earn-border bg-white px-3 py-2 text-sm outline-none focus:border-earn-primary"
        />
        <button
          type="submit"
          disabled={sending || !email}
          className="rounded-lg bg-earn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? "Sending…" : "Continue with email"}
        </button>
        {error && <p className="text-sm text-red-600">{error.message}</p>}
      </form>
    );
  }

  return (
    <form
      className="mx-auto flex w-full max-w-sm flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        verifyOTP({ otpVerification, verificationToken: code });
      }}
    >
      <p className="text-sm text-earn-text-secondary">
        Enter the code sent to {email}.
      </p>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="123456"
        className="rounded-lg border border-earn-border bg-white px-3 py-2 text-sm tracking-widest outline-none focus:border-earn-primary"
      />
      <button
        type="submit"
        disabled={verifying || !code}
        className="rounded-lg bg-earn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {verifying ? "Verifying…" : "Verify"}
      </button>
      <button
        type="button"
        onClick={() => {
          setCode("");
          resetSend();
        }}
        className="text-sm text-earn-text-secondary hover:text-earn-text-primary"
      >
        Use a different email
      </button>
      {error && <p className="text-sm text-red-600">{error.message}</p>}
    </form>
  );
}
