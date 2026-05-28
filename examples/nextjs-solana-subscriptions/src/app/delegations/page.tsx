"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Plus,
  Repeat,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Download,
} from "lucide-react";
import { useWallet } from "@/lib/useWallet";
import {
  useDelegationOperations,
  type DelegationWithAddress,
} from "@/lib/subscriptions";
import { shortenAddress } from "@/lib/utils";
import { toast } from "@/lib/toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatExpiry(expiryTs: bigint): string {
  if (expiryTs === 0n) return "No expiry";
  return new Date(Number(expiryTs) * 1000).toLocaleDateString();
}

function isDelegationExpired(expiryTs: bigint): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return expiryTs > 0n && expiryTs < now;
}

function formatUSDC(raw: bigint): string {
  const whole = raw / 1_000_000n;
  const frac = raw % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").slice(0, 2);
  return `${whole.toLocaleString()}.${fracStr} USDC`;
}

function formatPeriodSeconds(s: bigint): string {
  const n = Number(s);
  if (n < 3600) return `${Math.round(n / 60)} min`;
  if (n < 86400) return `${Math.round(n / 3600)} hr`;
  if (n < 604800) return `${Math.round(n / 86400)} day`;
  if (n < 2592000) return `${Math.round(n / 604800)} week`;
  return `${Math.round(n / 2592000)} month`;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ expired }: { expired: boolean }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
        expired
          ? "bg-red-50 text-red-700 border border-red-200"
          : "bg-green-50 text-green-700 border border-green-200"
      }`}
    >
      {expired ? "Expired" : "Active"}
    </span>
  );
}

// ── Claim button content ──────────────────────────────────────────────────────

function ClaimButtonContent({
  isClaiming,
  nothingToClaim,
  availableToClaim,
}: {
  isClaiming: boolean;
  nothingToClaim: boolean;
  availableToClaim: bigint;
}) {
  if (isClaiming) return <Loader2 className="w-4 h-4 animate-spin" />;
  if (nothingToClaim) return <>Nothing to claim</>;
  return (
    <>
      <Download className="w-4 h-4" />
      Claim {formatUSDC(availableToClaim)}
    </>
  );
}

// ── Create Delegation Dialog ──────────────────────────────────────────────────

const PERIOD_UNITS: Record<string, number> = {
  hours: 3600,
  days: 86400,
  weeks: 604800,
  months: 2592000,
};

function CreateDelegationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [delegateeAddress, setDelegateeAddress] = useState("");
  const [kind, setKind] = useState<"fixed" | "recurring">("fixed");
  const [amountStr, setAmountStr] = useState("");
  const [expiresDate, setExpiresDate] = useState("");
  // Recurring fields
  const [periodValue, setPeriodValue] = useState("1");
  const [periodUnit, setPeriodUnit] = useState("days");

  const { createFixedMutation, createRecurringMutation } =
    useDelegationOperations();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountRaw = BigInt(Math.round(parseFloat(amountStr) * 1_000_000));
    const expiryTs = expiresDate
      ? BigInt(Math.floor(new Date(expiresDate).getTime() / 1000))
      : 0n;
    const nonce = BigInt(Date.now());

    try {
      if (kind === "fixed") {
        await createFixedMutation.mutateAsync({
          delegateeAddress,
          amount: amountRaw,
          expiryTs,
          nonce,
        });
        toast.success("Fixed delegation created.");
      } else {
        const periodLengthS = BigInt(
          Math.round(parseFloat(periodValue)) * (PERIOD_UNITS[periodUnit] ?? 86400)
        );
        const startTs = BigInt(Math.floor(Date.now() / 1000));
        await createRecurringMutation.mutateAsync({
          delegateeAddress,
          amountPerPeriod: amountRaw,
          periodLengthS,
          startTs,
          expiryTs,
          nonce,
        });
        toast.success("Recurring delegation created.");
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create delegation";
      toast.error(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
    }
  };

  const isPending =
    createFixedMutation.isPending || createRecurringMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-[#DADADA] bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[#030303]">
            New Delegation
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-[#606060] hover:text-[#030303] text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Delegatee */}
          <div>
            <label className="block text-xs font-medium text-[#606060] mb-1">
              Delegatee Address
            </label>
            <input
              required
              value={delegateeAddress}
              onChange={(e) => setDelegateeAddress(e.target.value)}
              placeholder="Solana public key"
              className="w-full rounded-lg border border-[#DADADA] px-3 py-2 text-sm text-[#030303] placeholder-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#4779FF]/30"
            />
          </div>

          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-[#606060] mb-1">
              Delegation Type
            </label>
            <div className="flex gap-2">
              {(["fixed", "recurring"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setKind(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    kind === t
                      ? "bg-[#4779FF] text-white border-[#4779FF]"
                      : "bg-white text-[#606060] border-[#DADADA] hover:bg-[#F9F9F9]"
                  }`}
                >
                  {t === "fixed" ? "Fixed" : "Recurring"}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-[#606060] mb-1">
              {kind === "fixed" ? "Amount (USDC)" : "Amount per Period (USDC)"}
            </label>
            <input
              required
              type="number"
              min="0.000001"
              step="any"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-[#DADADA] px-3 py-2 text-sm text-[#030303] placeholder-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#4779FF]/30"
            />
          </div>

          {/* Recurring: period */}
          {kind === "recurring" && (
            <div>
              <label className="block text-xs font-medium text-[#606060] mb-1">
                Period Length
              </label>
              <div className="flex gap-2">
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(e.target.value)}
                  className="w-24 rounded-lg border border-[#DADADA] px-3 py-2 text-sm text-[#030303] focus:outline-none focus:ring-2 focus:ring-[#4779FF]/30"
                />
                <select
                  value={periodUnit}
                  onChange={(e) => setPeriodUnit(e.target.value)}
                  className="flex-1 rounded-lg border border-[#DADADA] px-3 py-2 text-sm text-[#030303] focus:outline-none focus:ring-2 focus:ring-[#4779FF]/30"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </div>
            </div>
          )}

          {/* Expiry */}
          <div>
            <label className="block text-xs font-medium text-[#606060] mb-1">
              Expires (optional)
            </label>
            <input
              type="date"
              value={expiresDate}
              onChange={(e) => setExpiresDate(e.target.value)}
              className="w-full rounded-lg border border-[#DADADA] px-3 py-2 text-sm text-[#030303] focus:outline-none focus:ring-2 focus:ring-[#4779FF]/30"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Delegation
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Outgoing delegation card ──────────────────────────────────────────────────

function OutgoingCard({
  delegation,
  myAddress,
  onRevoke,
  isRevoking,
}: {
  delegation: DelegationWithAddress;
  myAddress: string;
  onRevoke: () => void;
  isRevoking: boolean;
}) {
  const delegateeStr = delegation.data.header.delegatee as string;
  const isSelf = delegateeStr === myAddress;
  const expired = isDelegationExpired(
    delegation.kind === "fixed"
      ? delegation.data.expiryTs
      : delegation.data.expiryTs
  );

  return (
    <div className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#4779FF]/10 flex items-center justify-center shrink-0">
            {delegation.kind === "fixed" ? (
              <Lock className="w-4 h-4 text-[#4779FF]" />
            ) : (
              <Repeat className="w-4 h-4 text-[#4779FF]" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#030303]">
              {delegation.kind === "fixed" ? "Fixed" : "Recurring"}
            </p>
            <p className="text-xs text-[#606060]">
              To: {shortenAddress(delegateeStr)}
              {isSelf && (
                <span className="ml-1 text-[#4779FF]">(self)</span>
              )}
            </p>
          </div>
        </div>
        <StatusBadge expired={expired} />
      </div>

      <div className="rounded-lg bg-[#F9F9F9] px-3 py-2 space-y-1 text-xs text-[#606060]">
        {delegation.kind === "fixed" ? (
          <div className="flex justify-between">
            <span>Amount</span>
            <span className="font-medium text-[#030303]">
              {formatUSDC(delegation.data.amount)}
            </span>
          </div>
        ) : (
          <>
            <div className="flex justify-between">
              <span>Per period</span>
              <span className="font-medium text-[#030303]">
                {formatUSDC(delegation.data.amountPerPeriod)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Period</span>
              <span className="font-medium text-[#030303]">
                {formatPeriodSeconds(delegation.data.periodLengthS)}
              </span>
            </div>
          </>
        )}
        <div className="flex justify-between">
          <span>Expires</span>
          <span className="font-medium text-[#030303]">
            {formatExpiry(
              delegation.kind === "fixed"
                ? delegation.data.expiryTs
                : delegation.data.expiryTs
            )}
          </span>
        </div>
      </div>

      <button
        onClick={onRevoke}
        disabled={isRevoking}
        className="w-full py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRevoking ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Trash2 className="w-4 h-4" />
            Revoke
          </>
        )}
      </button>
    </div>
  );
}

// ── Incoming delegation card ──────────────────────────────────────────────────

function IncomingCard({
  delegation,
  onClaim,
  isClaiming,
}: {
  delegation: DelegationWithAddress;
  myAddress: string;
  onClaim: () => void;
  isClaiming: boolean;
}) {
  const delegatorStr = delegation.data.header.delegator as string;
  const expired = isDelegationExpired(delegation.data.expiryTs);

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  let availableToClaim: bigint;
  if (delegation.kind === "fixed") {
    availableToClaim = delegation.data.amount;
  } else {
    const periodEnd = delegation.data.currentPeriodStartTs + delegation.data.periodLengthS;
    if (nowSec >= periodEnd) {
      availableToClaim = delegation.data.amountPerPeriod;
    } else {
      const rem = delegation.data.amountPerPeriod - delegation.data.amountPulledInPeriod;
      availableToClaim = rem > 0n ? rem : 0n;
    }
  }
  const nothingToClaim = availableToClaim === 0n;

  return (
    <div className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
            {delegation.kind === "fixed" ? (
              <Lock className="w-4 h-4 text-green-600" />
            ) : (
              <Repeat className="w-4 h-4 text-green-600" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#030303]">
              {delegation.kind === "fixed" ? "Fixed" : "Recurring"}
            </p>
            <p className="text-xs text-[#606060]">
              From: {shortenAddress(delegatorStr)}
            </p>
          </div>
        </div>
        <StatusBadge expired={expired} />
      </div>

      <div className="rounded-lg bg-[#F9F9F9] px-3 py-2 space-y-1 text-xs text-[#606060]">
        <div className="flex justify-between">
          <span>Available to claim</span>
          <span className="font-medium text-[#030303]">
            {formatUSDC(availableToClaim)}
          </span>
        </div>
        {delegation.kind === "recurring" && (
          <>
            <div className="flex justify-between">
              <span>Per period</span>
              <span className="font-medium text-[#030303]">
                {formatUSDC(delegation.data.amountPerPeriod)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Period</span>
              <span className="font-medium text-[#030303]">
                {formatPeriodSeconds(delegation.data.periodLengthS)}
              </span>
            </div>
          </>
        )}
        <div className="flex justify-between">
          <span>Expires</span>
          <span className="font-medium text-[#030303]">
            {formatExpiry(delegation.data.expiryTs)}
          </span>
        </div>
      </div>

      <button
        onClick={onClaim}
        disabled={isClaiming || expired || nothingToClaim}
        className="w-full py-2 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ClaimButtonContent
          isClaiming={isClaiming}
          nothingToClaim={nothingToClaim}
          availableToClaim={availableToClaim}
        />
      </button>
    </div>
  );
}

// ── Tab content components ────────────────────────────────────────────────────

function OutgoingTab({
  loading,
  delegations,
  myAddress,
  revokingAddress,
  onRevoke,
  onOpenDialog,
}: {
  loading: boolean;
  delegations: DelegationWithAddress[];
  myAddress: string;
  revokingAddress: string | null;
  onRevoke: (addr: string) => void;
  onOpenDialog: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#606060]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading delegations…
      </div>
    );
  }

  if (delegations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#DADADA] bg-white p-12 text-center">
        <ArrowUpRight className="w-10 h-10 text-[#606060]/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-[#030303]">No outgoing delegations</p>
        <p className="text-xs text-[#606060] mt-1 mb-4">
          Create a delegation to grant token spending access to another address.
        </p>
        <button
          onClick={onOpenDialog}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors mx-auto"
        >
          <Plus className="w-4 h-4" />
          New Delegation
        </button>
      </div>
    );
  }

  const fixed = delegations.filter((d) => d.kind === "fixed");
  const recurring = delegations.filter((d) => d.kind === "recurring");

  return (
    <div className="space-y-6">
      {fixed.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#606060] uppercase tracking-wider mb-3">
            Fixed ({fixed.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fixed.map((d) => (
              <OutgoingCard
                key={d.address as string}
                delegation={d}
                myAddress={myAddress}
                onRevoke={() => onRevoke(d.address as string)}
                isRevoking={revokingAddress === (d.address as string)}
              />
            ))}
          </div>
        </div>
      )}
      {recurring.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#606060] uppercase tracking-wider mb-3">
            Recurring ({recurring.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recurring.map((d) => (
              <OutgoingCard
                key={d.address as string}
                delegation={d}
                myAddress={myAddress}
                onRevoke={() => onRevoke(d.address as string)}
                isRevoking={revokingAddress === (d.address as string)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IncomingTab({
  loading,
  delegations,
  myAddress,
  claimingAddress,
  onClaim,
}: {
  loading: boolean;
  delegations: DelegationWithAddress[];
  myAddress: string;
  claimingAddress: string | null;
  onClaim: (d: DelegationWithAddress) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#606060]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading delegations…
      </div>
    );
  }

  if (delegations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#DADADA] bg-white p-12 text-center">
        <ArrowDownLeft className="w-10 h-10 text-[#606060]/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-[#030303]">No incoming delegations</p>
        <p className="text-xs text-[#606060] mt-1">
          Someone needs to delegate to your address first.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {delegations.map((d) => (
        <IncomingCard
          key={d.address as string}
          delegation={d}
          myAddress={myAddress}
          onClaim={() => onClaim(d)}
          isClaiming={claimingAddress === (d.address as string)}
        />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DelegationsPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"outgoing" | "incoming">(
    "outgoing"
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revokingAddress, setRevokingAddress] = useState<string | null>(null);
  const [claimingAddress, setClaimingAddress] = useState<string | null>(null);

  const { loggedIn, solanaAccount } = useWallet();
  const {
    outgoingDelegations,
    incomingDelegations,
    loadingOutgoing,
    loadingIncoming,
    revokeMutation,
    claimFixedMutation,
    claimRecurringMutation,
  } = useDelegationOperations();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const myAddress = solanaAccount?.address ?? "";

  const handleRevoke = async (delegationAddress: string) => {
    setRevokingAddress(delegationAddress);
    try {
      await revokeMutation.mutateAsync({ delegationAddress });
      toast.success("Delegation revoked.");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to revoke delegation";
      toast.error(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
    } finally {
      setRevokingAddress(null);
    }
  };

  const recurringAvailable = (d: Extract<DelegationWithAddress, { kind: "recurring" }>): bigint => {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const periodEnd = d.data.currentPeriodStartTs + d.data.periodLengthS;
    if (nowSec >= periodEnd) return d.data.amountPerPeriod;
    const rem = d.data.amountPerPeriod - d.data.amountPulledInPeriod;
    return rem > 0n ? rem : 0n;
  };

  const handleClaim = async (delegation: DelegationWithAddress) => {
    const addr = delegation.address as string;
    setClaimingAddress(addr);
    try {
      if (delegation.kind === "fixed") {
        if (delegation.data.amount === 0n) throw new Error("Delegation fully claimed");
        await claimFixedMutation.mutateAsync({
          delegation: delegation as Extract<DelegationWithAddress, { kind: "fixed" }>,
          receiverAddress: myAddress,
        });
      } else {
        const recurringDelegation = delegation as Extract<DelegationWithAddress, { kind: "recurring" }>;
        const available = recurringAvailable(recurringDelegation);
        await claimRecurringMutation.mutateAsync({
          delegation: recurringDelegation,
          receiverAddress: myAddress,
          amount: available,
        });
      }
      toast.success("Claim successful!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      toast.error(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
    } finally {
      setClaimingAddress(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#030303]">Delegations</h1>
          <p className="text-sm text-[#606060] mt-1">
            Grant and manage token spending delegations.
          </p>
        </div>
        {loggedIn && (
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Delegation
          </button>
        )}
      </div>

      {!loggedIn ? (
        <div className="rounded-xl border border-[#DADADA] bg-white p-8 text-center">
          <Lock className="w-10 h-10 text-[#4779FF]/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-[#030303]">
            Sign in to manage delegations
          </p>
          <p className="text-xs text-[#606060] mt-1">
            Connect your wallet to view and create delegations.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-[#DADADA]">
            {(
              [
                { key: "outgoing", label: "Outgoing", icon: ArrowUpRight, count: outgoingDelegations.length },
                { key: "incoming", label: "Incoming", icon: ArrowDownLeft, count: incomingDelegations.length },
              ] as const
            ).map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === key
                    ? "border-[#4779FF] text-[#4779FF]"
                    : "border-transparent text-[#606060] hover:text-[#030303]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${activeTab === key ? "bg-[#4779FF]/10 text-[#4779FF]" : "bg-[#F0F0F0] text-[#606060]"}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === "outgoing" && (
            <OutgoingTab
              loading={loadingOutgoing}
              delegations={outgoingDelegations}
              myAddress={myAddress}
              revokingAddress={revokingAddress}
              onRevoke={handleRevoke}
              onOpenDialog={() => setDialogOpen(true)}
            />
          )}
          {activeTab === "incoming" && (
            <IncomingTab
              loading={loadingIncoming}
              delegations={incomingDelegations}
              myAddress={myAddress}
              claimingAddress={claimingAddress}
              onClaim={handleClaim}
            />
          )}
        </>
      )}

      <CreateDelegationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
