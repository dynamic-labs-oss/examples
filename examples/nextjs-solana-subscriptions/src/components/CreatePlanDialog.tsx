"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_ICONS } from "@/lib/plan-constants";
import { useMyPlansOperations } from "@/lib/subscriptions";
import { toast } from "@/lib/toast";

const USDC_MULTIPLIER = 1_000_000;

const PLAN_TEMPLATES = [
  {
    label: "Trading Bot",
    icon: "BarChart3",
    planName: "Trading Bot Pro",
    description: "Automated crypto trading signals & execution",
    amount: "49.99",
    periodValue: "1",
    periodUnit: "months" as const,
    website: "https://tradingbot.example.com",
  },
  {
    label: "Crypto News",
    icon: "Newspaper",
    planName: "Crypto NFAs Weekly",
    description: "Alpha calls & market analysis",
    amount: "19.99",
    periodValue: "1",
    periodUnit: "weeks" as const,
    website: "https://cryptonfas.example.com",
  },
  {
    label: "Cloud Storage",
    icon: "Cloud",
    planName: "Cloud Storage 1TB",
    description: "Decentralized encrypted cloud storage",
    amount: "4.99",
    periodValue: "1",
    periodUnit: "months" as const,
    website: "https://cloud.example.com",
  },
  {
    label: "Streaming",
    icon: "Video",
    planName: "Video Streaming Plus",
    description: "HD streaming with offline downloads",
    amount: "14.99",
    periodValue: "1",
    periodUnit: "months" as const,
    website: "https://streaming.example.com",
  },
];

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePlanDialog({ open, onOpenChange }: CreatePlanDialogProps) {
  const [planName, setPlanName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("");
  const [website, setWebsite] = useState("");
  const [amount, setAmount] = useState("");
  const [periodValue, setPeriodValue] = useState("");
  const [periodUnit, setPeriodUnit] = useState<"hours" | "days" | "weeks" | "months">("days");
  const [noEndDate, setNoEndDate] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [destinations, setDestinations] = useState<string[]>([]);
  const [pullers, setPullers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { createPlanMutation, tokenMintStr } = useMyPlansOperations();

  const UNIT_TO_HOURS = { hours: 1, days: 24, weeks: 168, months: 720 } as const;
  const periodHours = Number(periodValue) * UNIT_TO_HOURS[periodUnit];

  const metadataJson = useMemo(() => {
    const meta: Record<string, string> = { n: planName, d: description };
    if (selectedIcon) meta.i = selectedIcon;
    if (website) meta.w = website;
    return JSON.stringify(meta);
  }, [planName, description, selectedIcon, website]);

  const metadataBytes = useMemo(() => new TextEncoder().encode(metadataJson).length, [metadataJson]);

  const resetForm = () => {
    setPlanName("");
    setDescription("");
    setSelectedIcon("");
    setWebsite("");
    setAmount("");
    setPeriodValue("");
    setPeriodUnit("days");
    setNoEndDate(true);
    setEndDate("");
    setDestinations([]);
    setPullers([]);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) resetForm();
  };

  const applyTemplate = (t: (typeof PLAN_TEMPLATES)[number]) => {
    setPlanName(t.planName);
    setDescription(t.description);
    setSelectedIcon(t.icon);
    setWebsite(t.website);
    setAmount(t.amount);
    setPeriodValue(t.periodValue);
    setPeriodUnit(t.periodUnit);
  };

  const addAddress = (list: string[], setList: (v: string[]) => void) => {
    if (list.length < 4) setList([...list, ""]);
  };

  const removeAddress = (list: string[], setList: (v: string[]) => void, idx: number) => {
    setList(list.filter((_, i) => i !== idx));
  };

  const updateAddress = (
    list: string[],
    setList: (v: string[]) => void,
    idx: number,
    val: string
  ) => {
    const next = [...list];
    next[idx] = val;
    setList(next);
  };

  const isFormValid =
    planName.length > 0 &&
    description.length > 0 &&
    selectedIcon.length > 0 &&
    Number(amount) > 0 &&
    periodHours >= 1 &&
    metadataBytes <= 128 &&
    tokenMintStr.length > 0;

  const handleSubmit = async () => {
    if (!tokenMintStr) {
      setError("No token mint configured. Set NEXT_PUBLIC_TOKEN_MINT in .env.local");
      return;
    }
    setError(null);
    try {
      const planId = crypto.getRandomValues(new BigUint64Array(1))[0];
      const amountInSmallestUnits = BigInt(Math.round(Number(amount) * USDC_MULTIPLIER));
      const endTsRaw = endDate
        ? Math.floor(new Date(`${endDate}T12:00:00`).getTime() / 1000)
        : 0;
      const endTs = Number.isNaN(endTsRaw) ? 0 : endTsRaw;

      await createPlanMutation.mutateAsync({
        planId,
        mint: tokenMintStr,
        amount: amountInSmallestUnits,
        periodHours,
        endTs,
        destinations,
        pullers,
        metadataUri: metadataJson,
      });
      toast.success(`Plan "${planName}" created!`);
      handleOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create plan";
      const display = msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
      setError(display);
      toast.error(display);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-[#DADADA] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#DADADA] shrink-0">
          <h2 className="text-base font-semibold text-[#030303]">Create Subscription Plan</h2>
          <button
            onClick={() => handleOpenChange(false)}
            className="p-1 rounded-lg text-[#606060] hover:text-[#030303] hover:bg-[#F9F9F9] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Templates */}
        <div className="px-6 pt-4 shrink-0">
          <p className="text-xs font-medium text-[#606060] uppercase tracking-wider mb-2">Quick Templates</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {PLAN_TEMPLATES.map((t) => {
              const TIcon = PLAN_ICONS.find((i) => i.name === t.icon)?.icon;
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-[#DADADA] hover:border-[#030303] hover:text-[#030303] text-[#606060] transition-colors whitespace-nowrap shrink-0"
                >
                  {TIcon && <TIcon className="h-3.5 w-3.5" />}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-[#606060] uppercase tracking-wider">Metadata</p>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-[#030303]">Plan Name</label>
              <input
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="My Subscription"
                className="px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] text-[#030303]"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-[#030303]">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Access to premium features"
                className="px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] text-[#030303]"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-[#030303]">Icon</label>
              <select
                value={selectedIcon}
                onChange={(e) => setSelectedIcon(e.target.value)}
                className="px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] text-[#030303] bg-white"
              >
                <option value="">Select an icon</option>
                {PLAN_ICONS.map(({ name, label }) => (
                  <option key={name} value={name}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-[#030303]">
                Website URL{" "}
                <span className="font-normal text-[#606060]">(optional)</span>
              </label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] text-[#030303]"
              />
            </div>

            <div className="sm:col-span-2 text-right">
              <span
                className={cn(
                  "text-xs",
                  metadataBytes > 128 ? "text-red-600" : "text-[#606060]"
                )}
              >
                {metadataBytes}/128 bytes
              </span>
            </div>

            <div className="sm:col-span-2 h-px bg-[#DADADA]" />

            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-[#606060] uppercase tracking-wider">Plan Parameters</p>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-[#030303]">Amount per Period</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="9.99"
                  className="flex-1 px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] text-[#030303]"
                />
                <span className="px-3 py-2 text-sm border border-[#DADADA] rounded-lg text-[#606060] bg-[#F9F9F9]">
                  USDC
                </span>
              </div>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-[#030303]">Billing Period</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(e.target.value)}
                  placeholder="30"
                  className="flex-1 px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] text-[#030303]"
                />
                <select
                  value={periodUnit}
                  onChange={(e) => setPeriodUnit(e.target.value as typeof periodUnit)}
                  className="w-28 px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] text-[#030303] bg-white"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-2 grid gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#030303]">End Date/Time</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-[#606060]">No end date</span>
                  <input
                    type="checkbox"
                    checked={noEndDate}
                    onChange={(e) => {
                      setNoEndDate(e.target.checked);
                      if (e.target.checked) setEndDate("");
                    }}
                    className="h-4 w-4 rounded border-[#DADADA] text-[#4779FF] focus:ring-[#4779FF]"
                  />
                </label>
              </div>
              {noEndDate ? (
                <div className="flex items-center gap-2 rounded-lg border border-[#DADADA] bg-[#F9F9F9] px-3 py-2.5">
                  <span className="text-sm text-[#606060]">This plan will not have an end date</span>
                </div>
              ) : (
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] text-[#030303] bg-white"
                />
              )}
            </div>

            {/* Destinations */}
            <div className="sm:col-span-2 grid gap-2">
              <label className="text-xs font-medium text-[#030303]">
                Destinations{" "}
                <span className="font-normal text-[#606060]">(optional, max 4)</span>
              </label>
              {destinations.map((addr, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={addr}
                    onChange={(e) => updateAddress(destinations, setDestinations, i, e.target.value)}
                    placeholder="Solana address"
                    className="flex-1 px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] font-mono text-[#030303]"
                  />
                  <button
                    type="button"
                    onClick={() => removeAddress(destinations, setDestinations, i)}
                    className="p-2 rounded-lg text-[#606060] hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {destinations.length < 4 && (
                <button
                  type="button"
                  onClick={() => addAddress(destinations, setDestinations)}
                  className="flex items-center gap-1 text-xs text-[#4779FF] hover:underline w-fit"
                >
                  <Plus className="w-3 h-3" /> Add destination
                </button>
              )}
              <p className="text-xs text-[#606060]">
                Leave empty to allow any destination at transfer time.
              </p>
            </div>

            {/* Pullers */}
            <div className="sm:col-span-2 grid gap-2">
              <label className="text-xs font-medium text-[#030303]">
                Pullers{" "}
                <span className="font-normal text-[#606060]">(optional, max 4)</span>
              </label>
              {pullers.map((addr, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={addr}
                    onChange={(e) => updateAddress(pullers, setPullers, i, e.target.value)}
                    placeholder="Solana address"
                    className="flex-1 px-3 py-2 text-sm border border-[#DADADA] rounded-lg outline-none focus:border-[#4779FF] font-mono text-[#030303]"
                  />
                  <button
                    type="button"
                    onClick={() => removeAddress(pullers, setPullers, i)}
                    className="p-2 rounded-lg text-[#606060] hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {pullers.length < 4 && (
                <button
                  type="button"
                  onClick={() => addAddress(pullers, setPullers)}
                  className="flex items-center gap-1 text-xs text-[#4779FF] hover:underline w-fit"
                >
                  <Plus className="w-3 h-3" /> Add puller
                </button>
              )}
              <p className="text-xs text-[#606060]">
                Leave empty to restrict pulling to plan owner only (recommended).
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#DADADA] shrink-0 space-y-2">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={createPlanMutation.isPending || !isFormValid}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-[#4779FF] text-white hover:bg-[#3366ee] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {createPlanMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Plan"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
