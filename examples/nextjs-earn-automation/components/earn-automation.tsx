"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useGetWalletAccounts,
  useInitStatus,
  useUser,
} from "@dynamic-labs-sdk/react-hooks";
import { delegateWaasKeyShares } from "@dynamic-labs-sdk/client/waas";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { authFetch } from "@/lib/dynamic/auth-fetch";
import LoginForm from "@/components/dynamic/login-form";
import { txUrl } from "@/lib/explorers";
import {
  DEFAULT_FREQUENCY,
  FREQUENCIES,
  frequencyOf,
  type Frequency,
} from "@/lib/schedule";

type Vault = {
  vaultId: string;
  name?: string;
  assetSymbol: string;
  assetAddress: string;
  chainId: number;
  provider?: string;
  apy?: number;
};

type Rule = {
  id: string;
  walletAddress: string;
  vaultId: string;
  assetSymbol: string;
  chainId: number;
  mode: "sweep" | "fixed";
  amount?: string;
  sponsored: boolean;
  enabled: boolean;
  frequency?: Frequency;
  lastRun?: {
    status: string;
    txHash?: string;
    reason?: string;
    amount?: string;
    createdAt: string;
  } | null;
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function EarnAutomation() {
  const { data: initStatus } = useInitStatus();
  const { data: user } = useUser();
  const { data: walletAccounts = [] } = useGetWalletAccounts();

  const [delegated, setDelegated] = useState<Set<string>>(new Set());
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState("");
  const [vaultId, setVaultId] = useState("");
  const [mode, setMode] = useState<"sweep" | "fixed">("sweep");
  const [amount, setAmount] = useState("");
  const [sponsored, setSponsored] = useState(true);
  const [frequency, setFrequency] = useState<Frequency>(DEFAULT_FREQUENCY);
  const [copied, setCopied] = useState(false);

  const wallets = useMemo(
    () => walletAccounts.filter(isEvmWalletAccount),
    [walletAccounts]
  );
  // Stable string so refresh() only changes when the set of wallets does.
  const addressList = wallets.map((w) => w.address).join(",");

  const refresh = useCallback(async (): Promise<Set<string>> => {
    const [d, r] = await Promise.all([
      authFetch(
        `/api/delegations?addresses=${encodeURIComponent(addressList)}`
      ).then((r) => r.json()),
      authFetch("/api/rules").then((r) => r.json()),
    ]);
    const granted = new Set<string>(
      (d.delegations ?? []).map((x: { address: string }) =>
        x.address.toLowerCase()
      )
    );
    setDelegated(granted);
    setRules(r.rules ?? []);
    return granted;
  }, [addressList]);

  useEffect(() => {
    if (!user) return;
    refresh().catch(console.error);
    authFetch("/api/vaults")
      .then((r) => r.json())
      .then((d) => setVaults(d.vaults ?? []))
      .catch(console.error);
  }, [user, refresh]);

  const selectedVault = vaults.find((v) => v.vaultId === vaultId);

  useEffect(() => {
    if (!walletAddress && wallets[0]) setWalletAddress(wallets[0].address);
  }, [wallets, walletAddress]);

  if (initStatus !== "finished") {
    return <p className="text-sm text-earn-text-secondary">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-earn-border bg-white p-8 text-center">
        <p className="mb-4 text-sm text-earn-text-secondary">
          Sign in to create an automation.
        </p>
        <LoginForm />
      </div>
    );
  }

  const isDelegated = delegated.has(walletAddress.toLowerCase());

  const delegate = async () => {
    const wallet = wallets.find(
      (w) => w.address.toLowerCase() === walletAddress.toLowerCase()
    );
    if (!wallet) return;
    setBusy("delegate");
    setError(null);
    try {
      await delegateWaasKeyShares({ walletAccount: wallet });
      // The grant reaches the server via Dynamic's webhook, a moment after the
      // SDK call resolves — poll until it lands.
      for (let i = 0; i < 10; i++) {
        const granted = await refresh();
        if (granted.has(walletAddress.toLowerCase())) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delegation failed");
    } finally {
      setBusy(null);
    }
  };

  const createRule = async () => {
    setBusy("create");
    setError(null);
    try {
      const res = await authFetch("/api/rules", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          vaultId,
          mode,
          amount: mode === "fixed" ? amount : undefined,
          sponsored,
          frequency,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "failed to create rule");
      await refresh();
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create rule");
    } finally {
      setBusy(null);
    }
  };

  const patchRule = async (id: string, enabled: boolean) => {
    await authFetch(`/api/rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    await refresh();
  };

  const changeFrequency = async (id: string, next: Frequency) => {
    setError(null);
    const res = await authFetch(`/api/rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ frequency: next }),
    });
    if (!res.ok) setError("Failed to update frequency");
    await refresh();
  };

  const deleteRule = async (id: string) => {
    await authFetch(`/api/rules/${id}`, { method: "DELETE" });
    await refresh();
  };

  const runNow = async (id: string) => {
    setBusy(`run-${id}`);
    setError(null);
    try {
      const res = await authFetch(`/api/rules/${id}/run`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "run failed");
      if (body.run?.status === "failed") {
        setError(`Run failed: ${body.run.reason}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-earn-border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">New automation</h2>
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm">
            Wallet
            <select
              className="rounded-lg border border-earn-border px-3 py-2"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
            >
              {wallets.map((w) => (
                <option key={w.address} value={w.address}>
                  {short(w.address)}
                  {delegated.has(w.address.toLowerCase())
                    ? " (delegated)"
                    : ""}
                </option>
              ))}
            </select>
          </label>

          {walletAddress && (
            <div className="flex items-center gap-2 text-xs text-earn-text-secondary">
              <code className="break-all font-mono">{walletAddress}</code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(walletAddress);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    setError("Couldn't copy — select the address manually");
                  }
                }}
                className="shrink-0 rounded-md border border-earn-border px-2 py-0.5 hover:bg-earn-light"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}

          {!isDelegated && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
              <p className="mb-2">
                This wallet hasn&apos;t granted signing access yet. Delegation
                lets this app sign vault deposits on your behalf — you can
                revoke anytime.
              </p>
              <button
                onClick={delegate}
                disabled={busy === "delegate"}
                className="rounded-lg bg-earn-primary px-4 py-2 text-white disabled:opacity-50"
              >
                {busy === "delegate" ? "Delegating…" : "Delegate this wallet"}
              </button>
            </div>
          )}

          <label className="grid gap-1 text-sm">
            Vault
            <select
              className="rounded-lg border border-earn-border px-3 py-2"
              value={vaultId}
              onChange={(e) => setVaultId(e.target.value)}
            >
              <option value="">Select a vault</option>
              {vaults.map((v) => (
                <option key={v.vaultId} value={v.vaultId}>
                  {v.name ?? v.vaultId} — {v.assetSymbol} (chain {v.chainId}
                  {v.provider ? `, ${v.provider}` : ""})
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={mode === "sweep"}
                onChange={() => setMode("sweep")}
              />
              Sweep all {selectedVault?.assetSymbol ?? "of the asset"}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={mode === "fixed"}
                onChange={() => setMode("fixed")}
              />
              Fixed amount
            </label>
          </div>

          {mode === "fixed" && (
            <label className="grid gap-1 text-sm">
              Amount ({selectedVault?.assetSymbol ?? "asset"})
              <input
                className="rounded-lg border border-earn-border px-3 py-2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.5"
              />
            </label>
          )}

          <label className="grid gap-1 text-sm">
            Frequency
            <select
              className="rounded-lg border border-earn-border px-3 py-2"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
            >
              {Object.entries(FREQUENCIES).map(([key, f]) => (
                <option key={key} value={key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sponsored}
              onChange={(e) => setSponsored(e.target.checked)}
            />
            Gas sponsored (batched approve + deposit, no gas needed)
          </label>

          <button
            onClick={createRule}
            disabled={!isDelegated || !vaultId || (mode === "fixed" && !amount) || busy === "create"}
            className="rounded-lg bg-earn-primary px-4 py-2 text-white disabled:opacity-50"
          >
            {busy === "create" ? "Creating…" : "Create automation"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </section>

      <section className="rounded-xl border border-earn-border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">Your automations</h2>
        {rules.length === 0 && (
          <p className="text-sm text-earn-text-secondary">No automations yet.</p>
        )}
        <ul className="flex flex-col gap-3">
          {rules.map((r) => (
            <li key={r.id} className="rounded-lg border border-earn-border p-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">
                    {r.mode === "sweep"
                      ? `Sweep all ${r.assetSymbol}`
                      : `Deposit ${r.amount} ${r.assetSymbol}`}
                  </span>
                  <span className="ml-2 text-earn-text-secondary">
                    {short(r.walletAddress)} → vault {short(r.vaultId)} (chain{" "}
                    {r.chainId})
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    r.enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-neutral-100 text-earn-text-secondary"
                  }`}
                >
                  {r.enabled ? "enabled" : "paused"}
                </span>
              </div>
              {r.lastRun && (
                <p className="mt-2 text-xs text-earn-text-secondary">
                  Last run: {r.lastRun.status}
                  {r.lastRun.txHash && (
                    <>
                      {" — tx "}
                      {txUrl(r.chainId, r.lastRun.txHash) ? (
                        <a
                          href={txUrl(r.chainId, r.lastRun.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-earn-primary underline hover:text-earn-active-text"
                        >
                          {short(r.lastRun.txHash)}
                        </a>
                      ) : (
                        short(r.lastRun.txHash)
                      )}
                    </>
                  )}
                  {r.lastRun.reason && ` — ${r.lastRun.reason}`}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  aria-label="Frequency"
                  value={frequencyOf(r)}
                  onChange={(e) =>
                    changeFrequency(r.id, e.target.value as Frequency)
                  }
                  className="rounded-lg border border-earn-border px-2 py-1"
                >
                  {Object.entries(FREQUENCIES).map(([key, f]) => (
                    <option key={key} value={key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => runNow(r.id)}
                  disabled={busy === `run-${r.id}`}
                  className="rounded-lg border border-earn-border px-3 py-1 disabled:opacity-50"
                >
                  {busy === `run-${r.id}` ? "Running…" : "Run now"}
                </button>
                <button
                  onClick={() => patchRule(r.id, !r.enabled)}
                  className="rounded-lg border border-earn-border px-3 py-1"
                >
                  {r.enabled ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => deleteRule(r.id)}
                  className="rounded-lg border border-earn-border px-3 py-1 text-red-600"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
