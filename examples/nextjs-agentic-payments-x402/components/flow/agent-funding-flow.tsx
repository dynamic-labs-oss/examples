"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useWallet } from "@/lib/providers";
import LoginForm from "@/components/dynamic/login-form";
import { env } from "@/env";
import { Button } from "@/components/ui/button";

/**
 * The whole demo flow, in plain USD. No crypto vocabulary in the UI.
 *
 * 1. Not signed in  → "Set up your agent" + email login
 * 2. Signed in      → embedded wallet created (guarded), then "Authorize your agent"
 * 3. Authorized     → balance in USD + "Add funds" + agent-ready badge
 */
export default function AgentFundingFlow() {
  const { loggedIn, evmAccount, delegated, busy } = useWallet();

  // Gate on mount so the first client render matches the server (avoids a
  // hydration mismatch when the SDK restores the session on the client).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-dynamic" />
        </div>
      </Shell>
    );
  }

  if (!loggedIn) {
    return <SignInView />;
  }

  if (!evmAccount) {
    return (
      <Shell
        title="Setting up your account"
        subtitle="Creating your secure account — this only takes a moment."
      >
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-7 w-7 animate-spin text-dynamic" />
        </div>
      </Shell>
    );
  }

  if (!delegated) {
    return <AuthorizeView busy={busy} />;
  }

  return <FundingView address={evmAccount.address} />;
}

// ─── Shell ──────────────────────────────────────────────────────────────────

function Shell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-7 shadow-sm">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-dynamic/10">
          <Bot className="h-5 w-5 text-dynamic" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Agent Wallet</span>
      </div>
      {title && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}
      {subtitle && (
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      )}
      <div className={title ? "mt-6" : ""}>{children}</div>
    </div>
  );
}

// ─── 1. Sign in ────────────────────────────────────────────────────────────

function SignInView() {
  return (
    <Shell
      title="Set up your agent"
      subtitle="Create a secure account your agent can use to pay for services on your behalf — all in USD."
    >
      <ul className="mb-6 space-y-2.5 text-sm text-muted-foreground">
        <Bullet>Sign in with your email — no apps or extensions</Bullet>
        <Bullet>Add funds with a card, just like topping up a balance</Bullet>
        <Bullet>Your agent pays per-use, automatically</Bullet>
      </ul>
      <LoginForm />
    </Shell>
  );
}

// ─── 2. Authorize (delegate) ─────────────────────────────────────────────────

function AuthorizeView({ busy }: { busy: boolean }) {
  const { delegate } = useWallet();
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    try {
      setError(null);
      await delegate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorization failed");
    }
  };

  return (
    <Shell
      title="Authorize your agent"
      subtitle="Give your agent permission to spend from your account so it can pay for services without asking every time. You stay in control and can revoke access anytime."
    >
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-dynamic/20 bg-dynamic/5 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-dynamic" />
        <p className="text-sm text-muted-foreground">
          Your funds stay in your account. Authorization only lets your agent
          initiate payments — it can never move money anywhere you haven&apos;t
          approved.
        </p>
      </div>
      <Button
        onClick={handle}
        disabled={busy}
        className="w-full bg-dynamic text-white hover:bg-dynamic/90"
      >
        {busy ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Authorizing…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Authorize agent
          </span>
        )}
      </Button>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </Shell>
  );
}

// ─── 3. Funding ───────────────────────────────────────────────────────────────

function FundingView({ address }: { address: string }) {
  const [usd, setUsd] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/balance?address=${address}`);
      if (res.ok) setUsd((await res.json()).usd);
    } catch {
      /* keep last known balance */
    }
  }, [address]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    fetch(`/api/account?address=${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCode(d.code))
      .catch(() => {});
    return () => clearInterval(id);
  }, [refresh, address]);

  const isMainnet = env.NEXT_PUBLIC_X402_NETWORK !== "base-sepolia";
  const onramp = env.NEXT_PUBLIC_ONRAMP_URL;
  const faucet = env.NEXT_PUBLIC_FAUCET_URL;

  // Production on-ramp: a hosted card-purchase widget (MoonPay / Coinbase /
  // Crypto.com) via NEXT_PUBLIC_ONRAMP_URL, prefilled with the user's account
  // and amount. On testnet, fall back to the faucet.
  const addFundsUrl = (amount: number) => {
    if (onramp) {
      const u = new URL(onramp);
      u.searchParams.set("walletAddress", address);
      u.searchParams.set("baseCurrencyAmount", String(amount));
      return u.toString();
    }
    return faucet ?? "#";
  };

  const copy = async () => {
    await navigator.clipboard.writeText(code ?? address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const funded = usd !== null && Number(usd) > 0;

  return (
    <Shell>
      <div className="rounded-2xl border bg-gradient-to-b from-dynamic/5 to-transparent p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Available balance
        </p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">
          {usd === null ? "—" : `$${usd}`}
        </p>
        <div
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            funded
              ? "bg-green-500/10 text-green-600"
              : "bg-amber-500/10 text-amber-600"
          }`}
        >
          {funded ? (
            <>
              <Check className="h-3.5 w-3.5" /> Agent ready to spend
            </>
          ) : (
            "Add funds to activate your agent"
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">Add funds</p>
        <div className="grid grid-cols-3 gap-2">
          {[25, 50, 100].map((amt) => (
            <a key={amt} href={addFundsUrl(amt)} target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full">
                ${amt}
              </Button>
            </a>
          ))}
        </div>
        <a href={addFundsUrl(25)} target="_blank" rel="noreferrer">
          <Button className="mt-2 w-full bg-dynamic text-white hover:bg-dynamic/90">
            <Plus className="mr-1.5 h-4 w-4" /> Add funds with card
          </Button>
        </a>
        {!isMainnet && !onramp && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Demo on test network — &quot;Add funds&quot; opens the test faucet.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-xl border bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Your account code</p>
            <code className="text-lg font-semibold tracking-widest">
              {code ?? "…"}
            </code>
          </div>
          <button
            onClick={copy}
            className="flex shrink-0 items-center gap-1 text-xs text-dynamic hover:underline"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy
              </>
            )}
          </button>
        </div>
        <p className="mt-2 truncate text-[11px] text-muted-foreground">{address}</p>
      </div>
    </Shell>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-dynamic" />
      <span>{children}</span>
    </li>
  );
}
