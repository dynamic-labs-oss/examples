"use client";

import { useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetWalletAccounts,
  useInitStatus,
  useUser,
} from "@dynamic-labs-sdk/react-hooks";
import {
  depositToYieldVault,
  getTokenBalances,
  getYieldDetails,
  getYieldEarnings,
  getYieldPosition,
  listYieldVaults,
  withdrawFromYieldVault,
  type YieldVaultSummary,
} from "@dynamic-labs-sdk/client";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { formatUnits, parseUnits } from "viem";
import { chainName, txUrl } from "@/lib/explorers";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const usd = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Decimal fraction (0.05) → "5.00%". */
const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${(n * 100).toFixed(2)}%`;

/** Trim a decimal string to `dp` places without going through floats. */
function trimDecimals(s: string, dp = 6): string {
  const [int, frac = ""] = s.split(".");
  const f = frac.slice(0, dp).replace(/0+$/, "");
  return f ? `${int}.${f}` : int;
}

/** Raw token units (as a string/bigint) → human-readable, "—" if unparseable. */
function fromRaw(raw: string | bigint | null, decimals?: number): string {
  if (raw == null || decimals == null) return "—";
  try {
    return trimDecimals(formatUnits(BigInt(raw), decimals));
  } catch {
    return "—";
  }
}

const big = (s: string | null | undefined): bigint => {
  try {
    return BigInt(s ?? "0");
  } catch {
    return 0n;
  }
};

// The wallet is an EVM embedded wallet, so only EVM vaults can be used.
const isEvmVault = (v: YieldVaultSummary) =>
  !v.chainName || String(v.chainName).toUpperCase() === "EVM";

const vaultLabel = (v: YieldVaultSummary) => `${v.curator} · ${v.assetSymbol}`;

/** SDK errors often carry the useful part (the contract revert) in details/cause. */
function errorText(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  const x = e as Error & { details?: unknown; cause?: unknown };
  const extra = [x.details, x.cause instanceof Error ? x.cause.message : x.cause]
    .filter((v): v is string => typeof v === "string" && !!v && !x.message.includes(v));
  return [x.message, ...extra].join(" — ");
}

const DEFAULT_CHAIN = 8453; // Base
const VISIBLE_VAULTS = 5;

type Action = { kind: "deposit" | "withdraw"; vaultId: string };

const card = "rounded-xl border border-earn-border bg-white p-4";
const btn =
  "rounded-lg border border-earn-border px-3 py-1 text-sm hover:bg-earn-light disabled:opacity-50";

// ---------------------------------------------------------------------------

export default function Portfolio() {
  const { data: initStatus } = useInitStatus();
  const { data: user } = useUser();
  const { data: walletAccounts = [] } = useGetWalletAccounts();
  const qc = useQueryClient();

  const wallets = useMemo(
    () => walletAccounts.filter(isEvmWalletAccount),
    [walletAccounts]
  );
  const [selected, setSelected] = useState("");
  const wallet =
    wallets.find((w) => w.address.toLowerCase() === selected.toLowerCase()) ??
    wallets[0];
  const ready = initStatus === "finished" && !!user && !!wallet;

  const [chainPick, setChainPick] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ hash: string; chainId: number } | null>(
    null
  );

  // --- data ----------------------------------------------------------------
  // Every query hits Dynamic's API, which rate-limits (429) — and a 429 also
  // breaks deposit/withdraw. So: one chain at a time, no forced refresh, no
  // retries, no refetch-on-focus.
  const queryOpts = {
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  } as const;

  const vaultsQ = useQuery({
    queryKey: ["yield", "vaults"],
    queryFn: () => listYieldVaults(),
    enabled: ready,
    ...queryOpts,
    staleTime: 5 * 60_000,
  });
  const allVaults = useMemo(
    () => (vaultsQ.data ?? []).filter(isEvmVault),
    [vaultsQ.data]
  );
  const chainOptions = useMemo(
    () => [...new Set(allVaults.map((v) => v.chainId))].sort((a, b) => a - b),
    [allVaults]
  );
  const chainId =
    chainPick != null && chainOptions.includes(chainPick)
      ? chainPick
      : chainOptions.includes(DEFAULT_CHAIN)
        ? DEFAULT_CHAIN
        : chainOptions[0];
  const vaults = useMemo(
    () => allVaults.filter((v) => v.chainId === chainId),
    [allVaults, chainId]
  );
  const vaultById = useMemo(
    () => new Map(vaults.map((v) => [v.vaultId, v])),
    [vaults]
  );

  // Earnings = every vault position the wallet holds on the chain, with USD
  // value and PnL. Indexed, so it can trail a confirmed transaction.
  const earningsQ = useQuery({
    queryKey: ["yield", "earnings", wallet?.address, chainId],
    queryFn: () => getYieldEarnings({ chainId: chainId!, walletAccount: wallet! }),
    enabled: ready && chainId != null,
    ...queryOpts,
  });

  // Everything the wallet holds on the chain, with prices.
  const holdingsQ = useQuery({
    queryKey: ["balances", wallet?.address, chainId],
    queryFn: () =>
      getTokenBalances({
        walletAccount: wallet!,
        networkId: chainId!,
        includePrices: true,
        includeNative: true,
        filterSpamTokens: true,
      }),
    enabled: ready && chainId != null,
    ...queryOpts,
  });

  const heldVaults = (earningsQ.data?.vaults ?? []).filter(
    (e) => e.vaultId && big(e.assets) > 0n
  );

  // Position amounts are raw units; vault details carry the asset decimals.
  const detailIds = [
    ...new Set([
      ...heldVaults.map((e) => e.vaultId as string),
      ...(action ? [action.vaultId] : []),
    ]),
  ];
  const detailsQs = useQueries({
    queries: detailIds.map((id) => ({
      queryKey: ["yield", "details", id],
      queryFn: () => getYieldDetails({ vaultId: id }),
      enabled: ready,
      ...queryOpts,
      staleTime: Infinity,
    })),
  });
  const decimalsById = new Map(
    detailIds.map((id, i) => [id, detailsQs[i]?.data?.assetDecimals])
  );

  const positions = heldVaults.flatMap((e) => {
    const vault = vaultById.get(e.vaultId as string);
    if (!vault) return [];
    return [
      {
        vault,
        assets: big(e.assets),
        decimals: decimalsById.get(vault.vaultId),
        assetsUsd: e.assetsUsd,
        pnl: e.pnl,
        pnlUsd: e.pnlUsd,
        roe: e.roe,
      },
    ];
  });

  const holdings = (holdingsQ.data ?? [])
    .filter((t) => t.balance > 0 && !t.isSpam)
    .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
  const holdingKey = (chainId: number | undefined, address: string) =>
    `${chainId}:${address.toLowerCase()}`;
  const holdingByKey = new Map(
    (holdingsQ.data ?? []).map((t) => [holdingKey(t.networkId, t.address), t])
  );
  const balanceOf = (v: YieldVaultSummary) =>
    holdingByKey.get(holdingKey(v.chainId, v.assetAddress));

  const totalDeposited = earningsQ.data?.totalAssetsUsd ?? 0;
  const totalPnl = earningsQ.data?.totalPnlUsd ?? 0;
  const totalWallet = holdings.reduce((s, t) => s + (t.marketValue ?? 0), 0);

  const loading =
    vaultsQ.isLoading || earningsQ.isLoading || holdingsQ.isLoading;
  const loadError = vaultsQ.error ?? earningsQ.error ?? holdingsQ.error;

  // --- actions -------------------------------------------------------------

  const open = (kind: Action["kind"], vaultId: string) => {
    setAction({ kind, vaultId });
    setAmount("");
    setError(null);
    setDone(null);
    setStep(null);
  };

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["yield", "earnings"] });
    void qc.invalidateQueries({ queryKey: ["balances"] });
    void qc.invalidateQueries({ queryKey: ["yield", "position"] });
  };

  // Positions are indexed and can trail a mined transaction, so re-read a
  // bounded number of times after a write instead of once.
  const refreshSoon = () => {
    for (const ms of [3000, 12000]) setTimeout(refresh, ms);
  };

  // Earnings are indexed and can lag the chain, so withdrawals are limited by
  // the live on-chain position (read once when the panel opens).
  const positionQ = useQuery({
    queryKey: ["yield", "position", wallet?.address, action?.vaultId],
    queryFn: () =>
      getYieldPosition({ vaultId: action!.vaultId, walletAccount: wallet! }),
    enabled: ready && action?.kind === "withdraw",
    ...queryOpts,
    staleTime: 0,
    gcTime: 0,
  });

  const actionVault = action ? vaultById.get(action.vaultId) : undefined;
  const actionDecimals = action ? decimalsById.get(action.vaultId) : undefined;
  const actionHolding = actionVault ? balanceOf(actionVault) : undefined;

  const max = !action
    ? "0"
    : action.kind === "withdraw"
      ? positionQ.data
        ? fromRaw(positionQ.data.assets, actionDecimals)
        : "—"
      : actionHolding
        ? fromRaw(actionHolding.rawBalanceString, actionHolding.decimals)
        : "0";

  const amountValid = (() => {
    if (actionDecimals == null || !/^\d*\.?\d+$/.test(amount)) return false;
    if ((amount.split(".")[1]?.length ?? 0) > actionDecimals) return false;
    try {
      const a = parseUnits(amount, actionDecimals);
      return a > 0n && a <= parseUnits(max === "—" ? "0" : max, actionDecimals);
    } catch {
      return false;
    }
  })();

  const submit = async () => {
    if (!action || !wallet || !actionVault) return;
    setBusy(true);
    setError(null);
    setDone(null);
    setStep("Preparing…");
    try {
      const common = {
        vaultId: action.vaultId,
        walletAccount: wallet,
        amount,
        onTransactionStepChange: (p: { label?: string; ordinal: number; total: number }) =>
          setStep(`${p.label ?? "Transaction"} (${p.ordinal}/${p.total})`),
      };
      const { transactionHash } =
        action.kind === "deposit"
          ? await depositToYieldVault({
              ...common,
              onStepChange: (s) =>
                setStep(s === "approval" ? "Approving token…" : "Depositing…"),
            })
          : await withdrawFromYieldVault(common);
      setDone({ hash: transactionHash, chainId: actionVault.chainId });
      setAmount("");
      refreshSoon();
    } catch (e) {
      const msg = errorText(e, `${action.kind} failed`);
      setError(
        /47bc4b2c|NotEnoughAvailableUserBalance/i.test(msg)
          ? "That's more than your available balance in this vault. Press Max (it reads your live on-chain balance) and try again."
          : /\b429\b|too many|rate/i.test(msg)
            ? `${msg}. Dynamic may be rate-limiting this environment — wait a minute and retry.`
            : msg
      );
    } finally {
      setBusy(false);
      setStep(null);
    }
  };

  // --- render --------------------------------------------------------------

  if (!ready) return null;

  const sortedVaults = [...vaults].sort(
    (a, b) => (b.netApy ?? 0) - (a.netApy ?? 0)
  );
  const visibleVaults = showAll
    ? sortedVaults
    : sortedVaults.slice(0, VISIBLE_VAULTS);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-earn-text-primary">
          Portfolio
        </h2>
        <div className="flex items-center gap-2 text-sm">
          {chainOptions.length > 1 && chainId != null && (
            <select
              className="rounded-lg border border-earn-border px-2 py-1"
              value={chainId}
              onChange={(e) => {
                setChainPick(Number(e.target.value));
                setShowAll(false);
                setAction(null);
              }}
            >
              {chainOptions.map((c) => (
                <option key={c} value={c}>
                  {chainName(c)}
                </option>
              ))}
            </select>
          )}
          {wallets.length > 1 && (
            <select
              className="rounded-lg border border-earn-border px-2 py-1"
              value={wallet.address}
              onChange={(e) => {
                setSelected(e.target.value);
                setAction(null);
              }}
            >
              {wallets.map((w) => (
                <option key={w.address} value={w.address}>
                  {w.address.slice(0, 6)}…{w.address.slice(-4)}
                </option>
              ))}
            </select>
          )}
          <button type="button" className={btn} onClick={refresh}>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["Deposited", usd(totalDeposited)],
          ["Earned", usd(totalPnl)],
          ["In wallet", usd(totalWallet)],
        ].map(([label, value]) => (
          <div key={label} className={card}>
            <div className="text-xs text-earn-text-secondary">{label}</div>
            <div className="mt-1 text-lg font-medium text-earn-text-primary">
              {loading ? "…" : value}
            </div>
          </div>
        ))}
      </div>

      {loadError && (
        <p className="text-sm text-red-600">
          Couldn&apos;t load some data:{" "}
          {loadError instanceof Error ? loadError.message : "error"}. Dynamic
          rate-limits its API — wait a moment, then press Refresh.
        </p>
      )}

      {action && actionVault && (
        <div className={`${card} grid gap-3 border-earn-primary`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium capitalize">
                {action.kind} — {vaultLabel(actionVault)}
              </div>
              <div className="text-xs text-earn-text-secondary">
                {chainName(actionVault.chainId)} ·{" "}
                {action.kind === "deposit" ? "Wallet balance" : "Position"}:{" "}
                {max} {actionVault.assetSymbol}
              </div>
            </div>
            <button
              type="button"
              className={btn}
              onClick={() => setAction(null)}
              disabled={busy}
            >
              Close
            </button>
          </div>
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              placeholder={`Amount (${actionVault.assetSymbol})`}
              className="min-w-0 flex-1 rounded-lg border border-earn-border px-3 py-2 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
              disabled={busy}
            />
            <button
              type="button"
              className={btn}
              onClick={() => setAmount(max === "—" ? "" : max)}
              disabled={busy || max === "—" || max === "0"}
            >
              Max
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !amountValid}
              className="rounded-lg bg-earn-primary px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? (step ?? "Working…") : action.kind === "deposit" ? "Deposit" : "Withdraw"}
            </button>
          </div>
          {amount && !amountValid && !busy && (
            <p className="text-xs text-amber-700">
              Enter an amount between 0 and {max} {actionVault.assetSymbol}.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && (
            <p className="text-sm text-green-700">
              Confirmed.{" "}
              {txUrl(done.chainId, done.hash) ? (
                <a
                  className="underline"
                  href={txUrl(done.chainId, done.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction
                </a>
              ) : (
                <code className="break-all">{done.hash}</code>
              )}{" "}
              — balances can take a few seconds to update.
            </p>
          )}
        </div>
      )}

      <div className={card}>
        <h3 className="mb-2 text-sm font-medium">Your positions</h3>
        {positions.length === 0 ? (
          <p className="text-sm text-earn-text-secondary">
            {loading ? "Loading…" : "No vault positions yet — deposit below."}
          </p>
        ) : (
          <ul className="divide-y divide-earn-border">
            {positions.map((p) => (
              <li
                key={p.vault.vaultId}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{vaultLabel(p.vault)}</div>
                  <div className="text-xs text-earn-text-secondary">
                    {chainName(p.vault.chainId)} · {p.vault.provider} · APY{" "}
                    {pct(p.vault.netApy)}
                  </div>
                </div>
                <div className="text-right">
                  <div>
                    {fromRaw(p.assets, p.decimals)} {p.vault.assetSymbol}{" "}
                    <span className="text-earn-text-secondary">
                      ({usd(p.assetsUsd)})
                    </span>
                  </div>
                  <div className="text-xs text-earn-text-secondary">
                    Earned {p.pnl != null ? fromRaw(p.pnl, p.decimals) : "—"}{" "}
                    {p.vault.assetSymbol} ({usd(p.pnlUsd)}
                    {p.roe != null ? `, ${pct(p.roe)}` : ""})
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btn}
                    onClick={() => open("deposit", p.vault.vaultId)}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className={btn}
                    onClick={() => open("withdraw", p.vault.vaultId)}
                  >
                    Withdraw
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={card}>
        <h3 className="mb-2 text-sm font-medium">Wallet assets</h3>
        {holdings.length === 0 ? (
          <p className="text-sm text-earn-text-secondary">
            {loading ? "Loading…" : "No tokens in this wallet yet."}
          </p>
        ) : (
          <ul className="divide-y divide-earn-border">
            {holdings.map((t) => (
              <li
                key={holdingKey(t.networkId, t.address)}
                className="flex items-center justify-between py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{t.symbol}</span>{" "}
                  <span className="text-xs text-earn-text-secondary">
                    {t.networkId ? chainName(t.networkId) : ""}
                  </span>
                </div>
                <div className="text-right">
                  {trimDecimals(String(t.balance))}{" "}
                  <span className="text-earn-text-secondary">
                    ({usd(t.marketValue)})
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={card}>
        <h3 className="mb-2 text-sm font-medium">Available vaults</h3>
        {sortedVaults.length === 0 ? (
          <p className="text-sm text-earn-text-secondary">
            {vaultsQ.isLoading ? "Loading…" : "No vaults enabled."}
          </p>
        ) : (
          <ul className="divide-y divide-earn-border">
            {visibleVaults.map((v) => {
              const held = balanceOf(v);
              return (
                <li
                  key={v.vaultId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{vaultLabel(v)}</div>
                    <div className="text-xs text-earn-text-secondary">
                      {chainName(v.chainId)} · {v.provider} · TVL{" "}
                      {v.tvlUsd != null
                        ? v.tvlUsd.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                          })
                        : "—"}
                      {held ? ` · you hold ${trimDecimals(String(held.balance))} ${v.assetSymbol}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-earn-primary">
                      {pct(v.netApy)} APY
                    </span>
                    <button
                      type="button"
                      className={btn}
                      onClick={() => open("deposit", v.vaultId)}
                    >
                      Deposit
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {sortedVaults.length > VISIBLE_VAULTS && (
          <button
            type="button"
            className={`${btn} mt-3`}
            onClick={() => setShowAll((x) => !x)}
          >
            {showAll ? `Show top ${VISIBLE_VAULTS}` : `Show all ${sortedVaults.length}`}
          </button>
        )}
      </div>
    </section>
  );
}
