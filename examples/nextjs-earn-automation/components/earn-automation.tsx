"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/dynamic/auth-fetch";
import {
  DynamicWidget,
  useDynamicContext,
  useUserWallets,
  useWalletDelegation,
} from "@/lib/dynamic";

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
  const { user, primaryWallet, setShowAuthFlow } = useDynamicContext();
  const userWallets = useUserWallets();
  const { initDelegationProcess } = useWalletDelegation();

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

  const refresh = useCallback(async () => {
    const [d, r] = await Promise.all([
      authFetch("/api/delegations").then((r) => r.json()),
      authFetch("/api/rules").then((r) => r.json()),
    ]);
    setDelegated(new Set(d.delegations.map((x: { address: string }) => x.address.toLowerCase())));
    setRules(r.rules ?? []);
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh().catch(console.error);
    authFetch("/api/vaults")
      .then((r) => r.json())
      .then((d) => setVaults(d.vaults ?? []))
      .catch(console.error);
  }, [user, refresh]);

  const wallets = useMemo(
    () => userWallets.filter((w) => w.chain === "EVM"),
    [userWallets]
  );
  const selectedVault = vaults.find((v) => v.vaultId === vaultId);

  useEffect(() => {
    if (!walletAddress && primaryWallet) setWalletAddress(primaryWallet.address);
  }, [primaryWallet, walletAddress]);

  if (!user) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <p className="mb-4 text-sm text-neutral-500">
          Sign in to create an automation.
        </p>
        <DynamicWidget />
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
      await initDelegationProcess({ wallets: [wallet] });
      await refresh();
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
      <section className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">New automation</h2>
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm">
            Wallet
            <select
              className="rounded-lg border px-3 py-2"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.address}>
                  {short(w.address)}
                  {delegated.has(w.address.toLowerCase())
                    ? " (delegated)"
                    : ""}
                </option>
              ))}
            </select>
          </label>

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
                className="rounded-lg bg-[#4679fe] px-4 py-2 text-white disabled:opacity-50"
              >
                {busy === "delegate" ? "Delegating…" : "Delegate this wallet"}
              </button>
            </div>
          )}

          <label className="grid gap-1 text-sm">
            Vault
            <select
              className="rounded-lg border px-3 py-2"
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
                className="rounded-lg border px-3 py-2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.5"
              />
            </label>
          )}

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
            className="rounded-lg bg-[#4679fe] px-4 py-2 text-white disabled:opacity-50"
          >
            {busy === "create" ? "Creating…" : "Create automation"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">Your automations</h2>
        {rules.length === 0 && (
          <p className="text-sm text-neutral-500">No automations yet.</p>
        )}
        <ul className="flex flex-col gap-3">
          {rules.map((r) => (
            <li key={r.id} className="rounded-lg border p-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">
                    {r.mode === "sweep"
                      ? `Sweep all ${r.assetSymbol}`
                      : `Deposit ${r.amount} ${r.assetSymbol}`}
                  </span>
                  <span className="ml-2 text-neutral-500">
                    {short(r.walletAddress)} → vault {short(r.vaultId)} (chain{" "}
                    {r.chainId})
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    r.enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {r.enabled ? "enabled" : "paused"}
                </span>
              </div>
              {r.lastRun && (
                <p className="mt-2 text-xs text-neutral-500">
                  Last run: {r.lastRun.status}
                  {r.lastRun.txHash && ` — tx ${short(r.lastRun.txHash)}`}
                  {r.lastRun.reason && ` — ${r.lastRun.reason}`}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => runNow(r.id)}
                  disabled={busy === `run-${r.id}`}
                  className="rounded-lg border px-3 py-1 disabled:opacity-50"
                >
                  {busy === `run-${r.id}` ? "Running…" : "Run now"}
                </button>
                <button
                  onClick={() => patchRule(r.id, !r.enabled)}
                  className="rounded-lg border px-3 py-1"
                >
                  {r.enabled ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => deleteRule(r.id)}
                  className="rounded-lg border px-3 py-1 text-red-600"
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
