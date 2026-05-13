"use client";

import { useDynamicContext, DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { useState, useEffect, useCallback } from "react";
import { config } from "@/lib/config";
import { useKYCMetadata } from "@/lib/hooks/useKYCMetadata";
import {
  Loader2,
  Copy,
  Check,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import {
  CHAINS,
  TOKENS,
  FIAT_CURRENCIES_FALLBACK,
  FIAT_SYMBOLS,
} from "@/constants/ramp";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  RampType,
  RegisteredWallet,
  RegisteredBank,
  FiatCurrency,
  QuoteData,
  TransactionResult,
} from "@/types/ramp";

interface AutoRamp {
  id: string;
  kind?: string;
  type: string;
  status: string;
  name?: string;
  created_at?: string;
  source_currencies?: Array<{ code?: string; token?: string; type?: string; blockchain?: string }>;
  destination_currency?: { code?: string; token?: string; type?: string; blockchain?: string };
  quote?: {
    quote_id?: string;
    amount_in?: { amount: string; currency: { code: string } };
    amount_out?: { amount: string; currency: { code: string } };
    rate?: string;
    fee?: { total_fee?: { amount: string; currency: { code: string } } };
  };
  deposit_rails?: Array<{
    iban?: string;
    name?: string;
    bic?: string;
    beneficiary_name?: string;
    address?: string;
    account_number?: string;
    routing_number?: string;
    account_holder_name?: string;
    account_holder_address?: string;
    bank_address?: string;
    rails?: string[];
  }>;
  recipient?: {
    customer_id?: string;
    account_identifier?: { iban?: string; type?: string };
    provider_name?: string;
    address?: string | {
      street?: string;
      city?: string;
      state?: string;
      country?: string | { code?: string };
      postal_code?: string;
    };
    chain?: string;
    type?: string;
  };
}

const ONBOARD_STEPS = [
  { key: "connect", label: "Connect Wallet" },
  { key: "kyc", label: "KYC" },
  { key: "signings", label: "Sign Docs" },
  { key: "wallet", label: "Register Wallet" },
  { key: "bank", label: "Add Bank" },
];

export function RampInterface() {
  const { user } = useDynamicContext();
  const {
    customerId: metaCustomerId,
    step: onboardingStep,
    walletAddress: metaWalletAddress,
    bankIban: metaBankIban,
    isLoading: metadataLoading,
  } = useKYCMetadata();

  const [rampType, setRampType] = useState<RampType>("offramp");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [bankIban, setBankIban] = useState("");
  const isOnboarded = !!metaCustomerId && onboardingStep === "complete";

  const [selectedChain, setSelectedChain] = useState("");
  const [selectedToken, setSelectedToken] = useState("");
  const [selectedFiatCurrency, setSelectedFiatCurrency] = useState("");
  const [selectedBankIndex, setSelectedBankIndex] = useState<number | null>(
    null
  );
  const [selectedWalletIndex, setSelectedWalletIndex] = useState<
    number | null
  >(null);
  const [amount, setAmount] = useState("100");

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [registeredWallets, setRegisteredWallets] = useState<
    RegisteredWallet[]
  >([]);
  const [registeredBanks, setRegisteredBanks] = useState<RegisteredBank[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [fiatCurrencies, setFiatCurrencies] = useState<FiatCurrency[]>(
    FIAT_CURRENCIES_FALLBACK
  );

  const [transactions, setTransactions] = useState<AutoRamp[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedTx, setSelectedTx] = useState<AutoRamp | null>(null);

  useEffect(() => {
    if (metadataLoading || !isOnboarded) return;
    if (metaCustomerId) setCustomerId(metaCustomerId);
    if (metaWalletAddress) setWalletAddress(metaWalletAddress);
    if (metaBankIban) setBankIban(metaBankIban);
  }, [
    metadataLoading,
    isOnboarded,
    metaCustomerId,
    metaWalletAddress,
    metaBankIban,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function fetchFiat() {
      try {
        const res = await fetch(
          `${config.api.baseUrl}/api/iron/fiatcurrencies`
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const data = json.data ?? json;
        if (Array.isArray(data) && data.length > 0 && !cancelled) {
          setFiatCurrencies(
            data.map((c: { code: string; name: string }) => ({
              id: c.code,
              name: c.name,
              symbol: FIAT_SYMBOLS[c.code] ?? c.code,
            }))
          );
        }
      } catch {
        /* keep fallback */
      }
    }
    fetchFiat();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchRegisteredAccounts = useCallback(async () => {
    if (!customerId || !isOnboarded) return;
    setLoadingAccounts(true);
    try {
      const [walletsRes, banksRes] = await Promise.all([
        fetch(
          `${config.api.baseUrl}/api/iron/customers/${customerId}/wallets`,
          {
            headers: {
              "x-dynamic-environment-id": config.dynamic.environmentId,
            },
          }
        ),
        fetch(`${config.api.baseUrl}/api/iron/customers/${customerId}/banks`, {
          headers: {
            "x-dynamic-environment-id": config.dynamic.environmentId,
          },
        }),
      ]);
      if (walletsRes.ok) {
        const d = await walletsRes.json();
        setRegisteredWallets(d.data?.data || d.data || []);
      }
      if (banksRes.ok) {
        const d = await banksRes.json();
        setRegisteredBanks(d.data?.data || d.data || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingAccounts(false);
    }
  }, [customerId, isOnboarded]);

  useEffect(() => {
    if (customerId) fetchRegisteredAccounts();
  }, [customerId, fetchRegisteredAccounts]);

  useEffect(() => {
    if (registeredWallets.length > 0 && selectedWalletIndex === null) {
      const i = metaWalletAddress
        ? registeredWallets.findIndex(
            (w) =>
              w.address.toLowerCase() === metaWalletAddress.toLowerCase()
          )
        : 0;
      const idx = i >= 0 ? i : 0;
      setSelectedWalletIndex(idx);
      setWalletAddress(registeredWallets[idx].address);
      if (registeredWallets[idx].blockchain) {
        setSelectedChain(registeredWallets[idx].blockchain);
      }
    }
  }, [registeredWallets, selectedWalletIndex, metaWalletAddress]);

  useEffect(() => {
    if (registeredBanks.length > 0 && selectedBankIndex === null) {
      const i = metaBankIban
        ? registeredBanks.findIndex(
            (b) =>
              (b.iban || b.account_identifier?.iban) === metaBankIban
          )
        : 0;
      const idx = i >= 0 ? i : 0;
      setSelectedBankIndex(idx);
      setBankIban(
        registeredBanks[idx].iban ||
          registeredBanks[idx].account_identifier?.iban ||
          ""
      );
    }
  }, [registeredBanks, selectedBankIndex, metaBankIban]);

  useEffect(() => {
    if (!customerId || !isOnboarded) return;
    let cancelled = false;
    async function fetchTransactions() {
      setLoadingTransactions(true);
      try {
        const res = await fetch(
          `${config.api.baseUrl}/api/iron/customers/${customerId}/autoramps`,
          {
            headers: {
              "x-dynamic-environment-id": config.dynamic.environmentId,
            },
          }
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const data = json.data?.data || json.data || [];
        if (!cancelled) setTransactions(Array.isArray(data) ? data : []);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoadingTransactions(false);
      }
    }
    fetchTransactions();
    return () => {
      cancelled = true;
    };
  }, [customerId, isOnboarded, success]);

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      /* silent */
    }
  };

  const handleGetQuote = async () => {
    setError("");
    if (!customerId) {
      setError("Complete onboarding first.");
      return;
    }
    if (!selectedChain || !selectedToken || !selectedFiatCurrency) {
      setError("Select all fields.");
      return;
    }
    if (rampType === "offramp" && selectedBankIndex === null) {
      setError("Select a bank account.");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    setLoading(true);
    setQuote(null);
    try {
      const endpoint =
        rampType === "onramp"
          ? `${config.api.baseUrl}/api/onramp`
          : `${config.api.baseUrl}/api/offramp`;
      const selectedBank =
        selectedBankIndex !== null ? registeredBanks[selectedBankIndex] : null;
      const selectedWallet =
        selectedWalletIndex !== null
          ? registeredWallets[selectedWalletIndex]
          : null;
      const selectedIban =
        selectedBank?.iban || selectedBank?.account_identifier?.iban;
      const selectedWalletAddr = selectedWallet?.address || walletAddress;

      const body =
        rampType === "onramp"
          ? {
              action: "quote",
              customer_id: customerId,
              source_currency: selectedFiatCurrency,
              destination_currency: selectedToken,
              source_amount: parseFloat(amount) * 100,
              payment_rail: "sepa" as const,
              wallet_address: selectedWalletAddr,
              blockchain: selectedChain,
            }
          : {
              action: "quote",
              customer_id: customerId,
              source_currency: selectedToken,
              destination_currency: selectedFiatCurrency,
              source_amount: parseFloat(amount) * 1000000,
              bank_account_id: selectedIban,
              blockchain: selectedChain,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dynamic-environment-id": config.dynamic.environmentId,
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error || "";
        if (msg.includes("not active") || msg.includes("Customer is not active")) {
          throw new Error("Your Iron Finance account is not yet active. Complete onboarding fully and wait a moment before trying again.");
        }
        throw new Error(msg || `Failed to get ${rampType} quote`);
      }
      const data = await res.json();
      setQuote(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to get ${rampType} quote`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!quote) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const endpoint =
        rampType === "onramp"
          ? `${config.api.baseUrl}/api/onramp`
          : `${config.api.baseUrl}/api/offramp`;
      const selectedBank =
        selectedBankIndex !== null ? registeredBanks[selectedBankIndex] : null;
      const selectedWallet =
        selectedWalletIndex !== null
          ? registeredWallets[selectedWalletIndex]
          : null;
      const selectedIban =
        selectedBank?.iban || selectedBank?.account_identifier?.iban;
      const selectedWalletAddr = selectedWallet?.address || walletAddress;

      const body =
        rampType === "onramp"
          ? {
              action: "execute",
              quote_id: quote.id || quote.data?.id,
              customer_id: customerId,
              wallet_address: selectedWalletAddr,
              blockchain: selectedChain,
              source_currency: selectedFiatCurrency,
              destination_currency: selectedToken,
            }
          : {
              action: "execute",
              quote_id: quote.id || quote.data?.id,
              customer_id: customerId,
              bank_account_id: selectedIban,
              blockchain: selectedChain,
              source_currency: selectedToken,
              destination_currency: selectedFiatCurrency,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dynamic-environment-id": config.dynamic.environmentId,
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error || "";
        if (msg.includes("not active") || msg.includes("Customer is not active")) {
          throw new Error("Your Iron Finance account is not yet active. Complete onboarding fully and wait a moment before trying again.");
        }
        throw new Error(msg || `Failed to execute ${rampType}`);
      }
      const data = await res.json();
      setResult(data);
      setSuccess(
        `${rampType === "onramp" ? "Onramp" : "Offramp"} created successfully!`
      );
      setQuote(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to execute ${rampType}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Determine which onboarding steps are done
  const stepOrder = ["customer", "kyc", "signings", "wallet", "bank", "complete"];
  const currentStepIdx = stepOrder.indexOf(onboardingStep || "customer");

  const quoteData = quote?.data || quote;
  const paymentInstructions =
    result?.data?.payment_instructions || result?.payment_instructions;

  return (
    <div className="space-y-6 mt-6 pb-20">
      {/* Onboarding Status Card */}
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <CardTitle>Onboarding Status</CardTitle>
        </CardHeader>
        <CardContent>
          {!user ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Connect your wallet to start onramping and offramping.
              </p>
              <DynamicWidget />
            </div>
          ) : metadataLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading status...</span>
            </div>
          ) : isOnboarded ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Onboarding Complete</p>
                  <p className="text-xs text-muted-foreground">
                    Customer ID:{" "}
                    <span className="font-mono">{customerId || metaCustomerId}</span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
                    Wallet
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="font-mono text-xs">
                      {metaWalletAddress
                        ? `${metaWalletAddress.slice(0, 8)}...${metaWalletAddress.slice(-6)}`
                        : "—"}
                    </p>
                    {metaWalletAddress && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleCopy(metaWalletAddress, "wallet-addr")}
                      >
                        {copiedField === "wallet-addr" ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
                    Bank (IBAN)
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="font-mono text-xs">
                      {metaBankIban
                        ? `...${metaBankIban.slice(-8)}`
                        : "—"}
                    </p>
                    {metaBankIban && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleCopy(metaBankIban, "bank-iban")}
                      >
                        {copiedField === "bank-iban" ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {ONBOARD_STEPS.map((s, i) => {
                  const stepKey =
                    s.key === "connect" ? "customer" : s.key;
                  const stepPos =
                    s.key === "connect" ? 0 : stepOrder.indexOf(stepKey);
                  const isDone = currentStepIdx > stepPos;
                  const isCurrent =
                    onboardingStep === stepKey ||
                    (s.key === "connect" && !onboardingStep);
                  return (
                    <div key={s.key} className="flex flex-col items-center gap-1">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                          isDone
                            ? "bg-green-500 text-white"
                            : isCurrent
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className="text-xs text-center text-muted-foreground leading-tight">
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2">
                <Button asChild>
                  <Link href="/onboard">
                    Complete Onboarding{" "}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ramp Card */}
      {isOnboarded && (
        <Card className="max-w-5xl mx-auto">
          <CardHeader>
            <CardTitle>Quick Ramp</CardTitle>
            <CardDescription>
              Convert between fiat and stablecoins
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Ramp type toggle */}
            <div className="flex rounded-lg border bg-muted p-1 mb-6 max-w-xs">
              {(["onramp", "offramp"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setRampType(type);
                    setQuote(null);
                    setResult(null);
                    setError("");
                    setSuccess("");
                  }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    rampType === type
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type === "onramp" ? "Onramp" : "Offramp"}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-600 dark:text-green-400">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Form */}
              <div className="space-y-4">
                {!result && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Chain</Label>
                        <Select
                          value={selectedChain}
                          onValueChange={setSelectedChain}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select chain" />
                          </SelectTrigger>
                          <SelectContent>
                            {CHAINS.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>
                          {rampType === "onramp"
                            ? "Receive Token"
                            : "Send Token"}
                        </Label>
                        <Select
                          value={selectedToken}
                          onValueChange={setSelectedToken}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select token" />
                          </SelectTrigger>
                          <SelectContent>
                            {TOKENS.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>
                        {rampType === "onramp"
                          ? "Send Currency"
                          : "Receive Currency"}
                      </Label>
                      <Select
                        value={selectedFiatCurrency}
                        onValueChange={setSelectedFiatCurrency}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {fiatCurrencies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} {c.symbol && `(${c.symbol})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="100"
                        min="0"
                      />
                    </div>

                    {rampType === "onramp" && (
                      <div className="space-y-1.5">
                        <Label>Destination Wallet</Label>
                        {registeredWallets.length > 0 ? (
                          <Select
                            value={selectedWalletIndex?.toString() ?? ""}
                            onValueChange={(v) => {
                              const idx = parseInt(v);
                              setSelectedWalletIndex(idx);
                              setWalletAddress(registeredWallets[idx]?.address || "");
                              if (registeredWallets[idx]?.blockchain) {
                                setSelectedChain(registeredWallets[idx].blockchain);
                              }
                            }}
                            disabled={loadingAccounts}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select wallet" />
                            </SelectTrigger>
                            <SelectContent>
                              {registeredWallets.map((w, i) => (
                                <SelectItem key={w.id} value={i.toString()}>
                                  {w.blockchain} —{" "}
                                  {w.address.slice(0, 6)}...
                                  {w.address.slice(-4)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            placeholder="0x..."
                          />
                        )}
                      </div>
                    )}

                    {rampType === "offramp" && (
                      <div className="space-y-1.5">
                        <Label>Destination Bank Account</Label>
                        {registeredBanks.length > 0 ? (
                          <Select
                            value={selectedBankIndex?.toString() ?? ""}
                            onValueChange={(v) => {
                              const idx = parseInt(v);
                              setSelectedBankIndex(idx);
                              setBankIban(
                                registeredBanks[idx]?.iban ||
                                  registeredBanks[idx]?.account_identifier
                                    ?.iban ||
                                  ""
                              );
                            }}
                            disabled={loadingAccounts}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select bank" />
                            </SelectTrigger>
                            <SelectContent>
                              {registeredBanks.map((b, i) => (
                                <SelectItem key={b.id} value={i.toString()}>
                                  {b.bank_name || b.label || "Bank"} —{" "}
                                  {(
                                    b.iban ||
                                    b.account_identifier?.iban ||
                                    ""
                                  ).slice(-8)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={bankIban}
                            onChange={(e) => setBankIban(e.target.value)}
                            placeholder="DE89..."
                          />
                        )}
                      </div>
                    )}

                    <Button
                      className="w-full"
                      onClick={handleGetQuote}
                      disabled={loading}
                      variant={quote ? "outline" : "default"}
                    >
                      {loading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {quote ? "Refresh Quote" : "Get Quote"}
                    </Button>
                  </>
                )}
              </div>

              {/* Right: Quote / Result */}
              <div>
                {quote && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <p className="font-medium text-sm">Quote</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">You send</span>
                        <span className="font-medium">
                          {quoteData?.source_amount} {quoteData?.source_currency}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          You receive
                        </span>
                        <span className="font-medium">
                          {quoteData?.destination_amount}{" "}
                          {quoteData?.destination_currency}
                        </span>
                      </div>
                      {quoteData?.exchange_rate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rate</span>
                          <span>{quoteData.exchange_rate}</span>
                        </div>
                      )}
                      {quoteData?.fees?.total_fee !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fee</span>
                          <span>{quoteData.fees.total_fee}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1"
                        onClick={handleExecute}
                        disabled={loading}
                      >
                        {loading && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setQuote(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {result && paymentInstructions && (
                  <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-3">
                    <div>
                      <p className="font-medium text-sm">
                        {rampType === "onramp"
                          ? "Send Payment To"
                          : "Payout Initiated"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rampType === "onramp"
                          ? "Transfer funds to this account to complete your onramp."
                          : "Your crypto will be converted and sent to your bank."}
                      </p>
                    </div>
                    <div className="space-y-2 text-sm">
                      {Object.entries(paymentInstructions).map(([key, value]) =>
                        value ? (
                          <div
                            key={key}
                            className="flex justify-between items-center"
                          >
                            <span className="text-muted-foreground capitalize">
                              {key.replace(/_/g, " ")}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs">
                                {String(value)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  handleCopy(String(value), key)
                                }
                              >
                                {copiedField === key ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setResult(null);
                        setSuccess("");
                      }}
                    >
                      New Transaction
                    </Button>
                  </div>
                )}

                {!quote && !result && (
                  <div className="h-full flex items-center justify-center text-center p-6 rounded-lg border border-dashed">
                    <p className="text-sm text-muted-foreground">
                      Fill in the form and click{" "}
                      <span className="font-medium">Get Quote</span> to see
                      your rate.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Card */}
      {isOnboarded && (
        <Card className="max-w-2xl mx-auto mb-6">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTransactions ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading transactions...</span>
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No transactions yet.
              </p>
            ) : (
              <div className="space-y-0">
                {transactions.slice(0, 10).map((tx) => (
                  <button
                    key={tx.id}
                    className="w-full text-left py-3 border-b last:border-0 text-sm space-y-1 hover:bg-muted/40 -mx-1 px-1 rounded transition-colors cursor-pointer"
                    onClick={() => setSelectedTx(tx)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            tx.type === "onramp"
                              ? "bg-blue-500/10 text-blue-600"
                              : "bg-orange-500/10 text-orange-600"
                          }`}
                        >
                          {tx.type === "onramp" ? "Onramp" : "Offramp"}
                        </span>
                        <span className="text-muted-foreground text-xs font-mono">
                          {tx.id.slice(0, 12)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium ${
                            tx.status === "Approved" || tx.status === "completed"
                              ? "text-green-600"
                              : tx.status === "Rejected" || tx.status === "failed"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {tx.status}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {tx.quote?.amount_in?.amount
                          ? `${tx.quote.amount_in.amount} ${tx.quote.amount_in.currency?.code ?? ""}`
                          : "—"}
                        {tx.quote?.amount_out?.amount
                          ? ` → ${tx.quote.amount_out.amount} ${tx.quote.amount_out.currency?.code ?? ""}`
                          : ""}
                      </span>
                      {tx.created_at && (
                        <span>{new Date(tx.created_at).toLocaleString()}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={(o) => !o && setSelectedTx(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTx && <TxDetail tx={selectedTx} onCopy={handleCopy} copiedField={copiedField} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TxDetail({
  tx,
  onCopy,
  copiedField,
}: {
  tx: AutoRamp;
  onCopy: (text: string, field: string) => void;
  copiedField: string | null;
}) {
  const rail = tx.deposit_rails?.[0];
  const srcLabel =
    tx.source_currencies
      ?.map((c) => c.token || c.code || "")
      .filter(Boolean)
      .join(", ") ||
    tx.quote?.amount_in?.currency?.code ||
    "—";
  const dstLabel =
    (tx.destination_currency?.token || tx.destination_currency?.code || "") +
    (tx.destination_currency?.blockchain ? ` (${tx.destination_currency.blockchain})` : "") ||
    tx.quote?.amount_out?.currency?.code ||
    "—";

  function Row({ label, value, copyKey }: { label: string; value?: string | null; copyKey?: string }) {
    if (!value) return null;
    return (
      <div className="flex items-center justify-between py-1 border-b last:border-0 text-sm">
        <span className="text-muted-foreground text-xs shrink-0 mr-3">{label}</span>
        <div className="flex items-center gap-1 min-w-0">
          <span className="font-mono text-xs truncate">{value}</span>
          {copyKey && (
            <button
              className="shrink-0 p-0.5 rounded hover:bg-muted cursor-pointer"
              onClick={() => onCopy(value, copyKey)}
            >
              {copiedField === copyKey ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{title}</p>
        <div className="rounded-md border px-3">{children}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <Section title="Main">
        {tx.name && <Row label="Name" value={tx.name} />}
        <Row label="ID" value={tx.id} copyKey="detail-id" />
        <Row label="Source" value={srcLabel} />
        <Row label="Destination" value={dstLabel} />
        {tx.quote?.amount_in?.amount && (
          <Row
            label="Amount In"
            value={`${tx.quote.amount_in.amount} ${tx.quote.amount_in.currency?.code ?? ""}`}
          />
        )}
        {tx.quote?.amount_out?.amount && (
          <Row
            label="Amount Out"
            value={`${tx.quote.amount_out.amount} ${tx.quote.amount_out.currency?.code ?? ""}`}
          />
        )}
        {tx.quote?.rate && <Row label="Rate" value={tx.quote.rate} />}
        {tx.quote?.fee?.total_fee?.amount && (
          <Row
            label="Total Fee"
            value={`${tx.quote.fee.total_fee.amount} ${tx.quote.fee.total_fee.currency?.code ?? ""}`}
          />
        )}
        <div className="flex items-center justify-between py-1 border-b last:border-0 text-sm">
          <span className="text-muted-foreground text-xs">Status</span>
          <span
            className={`text-xs font-medium ${
              tx.status === "Approved" || tx.status === "completed"
                ? "text-green-600"
                : tx.status === "Rejected" || tx.status === "failed"
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {tx.status}
          </span>
        </div>
        {tx.created_at && (
          <Row label="Created" value={new Date(tx.created_at).toLocaleString()} />
        )}
      </Section>

      {(rail || tx.recipient) && (
        <div className="space-y-4">
          {rail && (
            <Section title="Deposit Account">
              {rail.name && <Row label="Bank Name" value={rail.name} copyKey="d-bank" />}
              {rail.iban && <Row label="IBAN" value={rail.iban} copyKey="d-iban" />}
              {rail.account_number && <Row label="Account Number" value={rail.account_number} copyKey="d-acct" />}
              {rail.routing_number && <Row label="Routing Number" value={rail.routing_number} copyKey="d-routing" />}
              {rail.bic && <Row label="BIC/SWIFT" value={rail.bic} copyKey="d-bic" />}
              {rail.beneficiary_name && <Row label="Beneficiary" value={rail.beneficiary_name} copyKey="d-bene" />}
              {rail.account_holder_name && <Row label="Account Holder" value={rail.account_holder_name} copyKey="d-holder" />}
              {rail.address && <Row label="Bank Address" value={rail.address} copyKey="d-addr" />}
              {rail.bank_address && <Row label="Bank Address" value={rail.bank_address} copyKey="d-baddr" />}
              {rail.account_holder_address && <Row label="Holder Address" value={rail.account_holder_address} copyKey="d-haddr" />}
            </Section>
          )}

          {tx.recipient && (
            <Section title="Recipient Account">
              {tx.recipient.type && <Row label="Type" value={tx.recipient.type} />}
              {typeof tx.recipient.address === "string" && (
                <Row label="Address" value={tx.recipient.address} copyKey="r-addr" />
              )}
              {tx.recipient.chain && <Row label="Chain" value={tx.recipient.chain} />}
              {tx.recipient.account_identifier?.iban && (
                <Row label="IBAN" value={tx.recipient.account_identifier.iban} copyKey="r-iban" />
              )}
              {tx.recipient.provider_name && <Row label="Bank" value={tx.recipient.provider_name} />}
              {tx.recipient.address && typeof tx.recipient.address === "object" && (
                <Row
                  label="Bank Address"
                  value={[
                    tx.recipient.address.street,
                    tx.recipient.address.city,
                    tx.recipient.address.state,
                    tx.recipient.address.postal_code,
                    typeof tx.recipient.address.country === "string"
                      ? tx.recipient.address.country
                      : tx.recipient.address.country?.code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              )}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
