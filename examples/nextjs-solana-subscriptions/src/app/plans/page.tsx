"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, ClipboardPen, Trash2, Star } from "lucide-react";
import { useWallet } from "@/lib/useWallet";
import { useMyPlansOperations } from "@/lib/subscriptions";
import { CreatePlanDialog } from "@/components/CreatePlanDialog";
import { parsePlanMeta, formatTokenAmount, formatPeriod, shortenAddress, getTokenInfo } from "@/lib/utils";
import { ICON_MAP } from "@/lib/plan-constants";
import { PlanStatus } from "@/lib/subscriptions";
import { toast } from "@/lib/toast";

type Plans = ReturnType<typeof useMyPlansOperations>["myPlans"];

function PlansBody({
  loggedIn,
  loading,
  error,
  plans,
  deletingAddress,
  isPendingDelete,
  onDelete,
  onOpenDialog,
}: {
  loggedIn: boolean;
  loading: boolean;
  error: Error | null;
  plans: Plans;
  deletingAddress: string | null;
  isPendingDelete: boolean;
  onDelete: (planAddress: string) => void;
  onOpenDialog: () => void;
}) {
  if (!loggedIn) {
    return (
      <div className="rounded-xl border border-[#DADADA] bg-white p-8 text-center">
        <ClipboardPen className="w-10 h-10 text-[#606060]/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-[#030303]">Sign in to manage your plans</p>
        <p className="text-xs text-[#606060] mt-1">
          Connect your wallet to create and manage subscription plans.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#606060]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading plans…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Failed to load plans: {error.message}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#DADADA] bg-white p-12 text-center">
        <ClipboardPen className="w-10 h-10 text-[#606060]/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-[#030303]">No plans yet</p>
        <p className="text-xs text-[#606060] mt-1 mb-4">
          Create your first subscription plan to start collecting recurring payments.
        </p>
        <button
          onClick={onOpenDialog}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors mx-auto"
        >
          <Plus className="w-4 h-4" />
          Create Plan
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const meta = parsePlanMeta(plan.data.data.metadataUri);
        const planName = meta.n || `Plan #${plan.data.data.planId}`;
        const planDesc = meta.d || "";
        const PlanIcon = (meta.i && ICON_MAP[meta.i]) || Star;
        const { amount, periodHours } = plan.data.data.terms;
        const mint = plan.data.data.mint as string;
        const token = getTokenInfo(mint);
        const amountFormatted = formatTokenAmount(amount, token.decimals);
        const periodLabel = formatPeriod(periodHours);
        const isActive = plan.data.status === PlanStatus.Active;
        const planAddress = plan.address as string;
        const isDeleting = deletingAddress === planAddress;

        return (
          <div
            key={planAddress}
            className="rounded-xl border border-[#DADADA] bg-white p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#4779FF]/10 flex items-center justify-center">
                  <PlanIcon className="w-4 h-4 text-[#4779FF]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#030303]">{planName}</p>
                  {planDesc && (
                    <p className="text-xs text-[#606060] truncate max-w-[140px]">{planDesc}</p>
                  )}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                  isActive
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {isActive ? "Active" : "Sunset"}
              </span>
            </div>

            <div className="rounded-lg bg-[#F9F9F9] p-3 text-center">
              <p className="text-xl font-bold text-[#030303]">
                {amountFormatted}{" "}
                <span className="text-sm font-medium text-[#606060]">{token.symbol}</span>
              </p>
              <p className="text-xs text-[#606060] mt-0.5">{periodLabel}</p>
            </div>

            <div className="space-y-1 text-xs text-[#606060]">
              <div className="flex justify-between">
                <span>Plan Address</span>
                <span className="font-mono">{shortenAddress(planAddress)}</span>
              </div>
              {meta.w && (
                <div className="flex justify-between">
                  <span>Website</span>
                  <a
                    href={meta.w}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#4779FF] hover:underline truncate max-w-[120px]"
                  >
                    {meta.w.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => onDelete(planAddress)}
              disabled={isDeleting || isPendingDelete}
              className="w-full py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Plan
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function PlansPage() {
  const [mounted, setMounted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);
  const { loggedIn } = useWallet();

  const { myPlans, loadingMyPlans, myPlansError, deletePlanMutation } = useMyPlansOperations();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleDelete = async (planAddress: string) => {
    if (!confirm("Are you sure you want to delete this plan? This cannot be undone.")) return;
    setDeletingAddress(planAddress);
    try {
      await deletePlanMutation.mutateAsync(planAddress);
      toast.success("Plan deleted.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast.error(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
    } finally {
      setDeletingAddress(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#030303]">My Plans</h1>
          <p className="text-sm text-[#606060] mt-1">
            Create and manage your subscription plans as a merchant.
          </p>
        </div>
        {loggedIn && (
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Plan
          </button>
        )}
      </div>

      <PlansBody
        loggedIn={loggedIn}
        loading={loadingMyPlans}
        error={myPlansError as Error | null}
        plans={myPlans}
        deletingAddress={deletingAddress}
        isPendingDelete={deletePlanMutation.isPending}
        onDelete={handleDelete}
        onOpenDialog={() => setDialogOpen(true)}
      />

      <CreatePlanDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
