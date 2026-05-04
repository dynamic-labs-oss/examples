"use client";

import { useState, useCallback } from "react";
import { config } from "@/lib/config";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useKYCMetadata, type OnboardStep } from "@/lib/hooks/useKYCMetadata";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useWallet } from "@/lib/providers";
import { dynamicClient } from "@/lib/dynamic";

interface RequiredSigning {
  id: string;
  display_name: string;
  type: string;
  url?: string;
  text?: string;
}

const STEPS: { key: OnboardStep; label: string }[] = [
  { key: "customer", label: "Profile" },
  { key: "kyc", label: "KYC" },
  { key: "signings", label: "Sign" },
  { key: "wallet", label: "Wallet" },
  { key: "bank", label: "Bank" },
  { key: "complete", label: "Done" },
];

export default function OnboardPage() {
  const { evmAccount, loggedIn } = useWallet();
  const {
    customerId,
    identificationId,
    kycUrl,
    step,
    isLoading: initializing,
    updateState,
    reset,
  } = useKYCMetadata();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requiredSignings, setRequiredSignings] = useState<RequiredSigning[]>([]);
  const isSandbox =
    process.env.NEXT_PUBLIC_IRON_ENVIRONMENT === "sandbox" ||
    !process.env.NEXT_PUBLIC_IRON_ENVIRONMENT;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    countryCode: "DE",
    dateOfBirth: "",
    phoneNumber: "",
  });

  const [bankData, setBankData] = useState({
    accountHolderName: "",
    iban: "",
    bankName: "",
    bankCountry: "DE",
    street: "",
    city: "",
    state: "",
    country: "DE",
    postalCode: "",
  });

  const handleStartOver = useCallback(async () => {
    if (!confirm("Start over? This will clear your progress.")) return;
    await reset();
    setError("");
    setRequiredSignings([]);
  }, [reset]);

  const handleCreateCustomer = async () => {
    const user = dynamicClient.user;
    if (!user?.email) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${config.api.baseUrl}/api/iron/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "individual",
          email: user.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          country_code: formData.countryCode,
          date_of_birth: formData.dateOfBirth,
          phone_number: formData.phoneNumber,
        }),
      });
      if (!res.ok) throw new Error("Failed to create customer");
      const result = await res.json();
      await updateState({ customerId: result.data.id, step: "kyc" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setLoading(false);
    }
  };

  const handleStartKYC = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${config.api.baseUrl}/api/iron/customers/${customerId}/kyc`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ return_url: window.location.origin + "/onboard" }),
        }
      );
      if (!res.ok) throw new Error("Failed to start KYC");
      const result = await res.json();
      const updates: Partial<{ identificationId: string; kycUrl: string; step: OnboardStep }> = {
        step: "kyc",
      };
      if (result.data?.id) updates.identificationId = result.data.id;
      if (result.data?.verification_url || result.data?.url) {
        updates.kycUrl = result.data.verification_url || result.data.url;
      }
      await updateState(updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start KYC");
    } finally {
      setLoading(false);
    }
  };

  const handleSandboxApproveKYC = async () => {
    let idToApprove = identificationId;
    if (!idToApprove) {
      try {
        setLoading(true);
        const res = await fetch(
          `${config.api.baseUrl}/api/iron/customers/${customerId}/identifications`
        );
        if (res.ok) {
          const result = await res.json();
          const pending = result.data?.find(
            (id: { status: string }) => id.status === "Pending" || id.status === "Processed"
          );
          if (pending?.id) {
            idToApprove = pending.id;
            await updateState({ identificationId: pending.id });
          } else {
            throw new Error("No pending identification found");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch identification");
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${config.api.baseUrl}/api/iron/sandbox/identification/${idToApprove}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved: true }),
        }
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to approve identification");
      }

      const signingsRes = await fetch(
        `${config.api.baseUrl}/api/iron/customers/${customerId}/signings`
      );
      if (signingsRes.ok) {
        const signingsResult = await signingsRes.json();
        const signings: RequiredSigning[] = signingsResult.data || [];
        if (signings.length === 0) {
          await updateState({ step: "wallet" });
        } else {
          for (const signing of signings) {
            await fetch(
              `${config.api.baseUrl}/api/iron/customers/${customerId}/signings`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content_id: signing.id,
                  content_type: signing.type || "Url",
                  signed: true,
                }),
              }
            );
          }
          await updateState({ step: "wallet" });
        }
      } else {
        const signingsError = await signingsRes.json().catch(() => ({}));
        const signingsMsg = signingsError.error || "";
        if (signingsMsg.includes("does not require signings") || signingsMsg.includes("no required signings")) {
          await updateState({ step: "wallet" });
        } else {
          await updateState({ step: "signings" });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve identification");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchSignings = async (): Promise<boolean> => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${config.api.baseUrl}/api/iron/customers/${customerId}/signings`
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error || "";
        if (errorMsg.includes("not in status SigningsRequired")) {
          setError("KYC still pending. Please wait a moment and try again.");
          return false;
        }
        if (res.status === 404 || errorMsg.includes("does not require signings") || errorMsg.includes("no required signings")) {
          setRequiredSignings([]);
          await updateState({ step: "wallet" });
          return true;
        }
        throw new Error(errorMsg || "Failed to fetch signings");
      }
      const result = await res.json();
      const signings = result.data || [];
      if (signings.length === 0) {
        await updateState({ step: "wallet" });
      } else {
        setRequiredSignings(signings);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch signings");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSignDocument = async (signing: RequiredSigning) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${config.api.baseUrl}/api/iron/customers/${customerId}/signings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_id: signing.id,
            content_type: signing.type || "Url",
            signed: true,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to sign document");
      const remaining = requiredSignings.filter((s) => s.id !== signing.id);
      setRequiredSignings(remaining);
      if (remaining.length === 0) await updateState({ step: "wallet" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign document");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWallet = async () => {
    setLoading(true);
    setError("");
    try {
      if (!evmAccount) throw new Error("No wallet connected.");
      let walletAddress = evmAccount.address;
      if (!walletAddress) throw new Error("Unable to get wallet address");
      walletAddress = walletAddress.toLowerCase();

      const now = new Date();
      const dateStr = `${now.getUTCDate().toString().padStart(2, "0")}/${(now.getUTCMonth() + 1).toString().padStart(2, "0")}/${now.getUTCFullYear()}`;
      const proofMessage = `I am verifying ownership of the wallet address ${walletAddress} as customer ${customerId}. This message was signed on ${dateStr} to confirm my control over this wallet.`;
      const signature = await evmAccount.signMessage(proofMessage);
      if (!signature) throw new Error("Failed to sign message");

      const walletPayload = {
        customer_id: customerId,
        blockchain: "Base",
        address: walletAddress,
        message: proofMessage,
        signature,
      };

      let lastMsg = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch(`${config.api.baseUrl}/api/iron/wallets/self-hosted`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(walletPayload),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          lastMsg = errorData.error || errorData.message || "";
          if ((lastMsg.includes("not active") || lastMsg.includes("Customer is not active")) && attempt < 5) {
            continue;
          }
          if (lastMsg.includes("not active") || lastMsg.includes("Customer is not active")) {
            throw new Error("Your account is still being activated by Iron Finance. Please wait a moment and try again.");
          }
          const isAlreadyRegistered =
            lastMsg.toLowerCase().includes("already") ||
            lastMsg.toLowerCase().includes("duplicate") ||
            lastMsg.toLowerCase().includes("exists") ||
            lastMsg.toLowerCase().includes("conflict");
          if (isAlreadyRegistered) {
            const walletsRes = await fetch(
              `${config.api.baseUrl}/api/iron/customers/${customerId}/wallets`
            );
            if (walletsRes.ok) {
              const walletsData = await walletsRes.json();
              const existing = (walletsData.data?.data || walletsData.data || []).find(
                (w: { address?: string; wallet_address?: string }) =>
                  (w.address || w.wallet_address)?.toLowerCase() === walletAddress
              );
              if (existing?.id) {
                await updateState({ walletId: existing.id, walletAddress, step: "bank" });
                return;
              }
            }
          }
          throw new Error(lastMsg || "Failed to register wallet");
        }
        const result = await res.json();
        await updateState({ walletId: result.data.id, walletAddress, step: "bank" });
        break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register wallet");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBankAccount = async () => {
    setLoading(true);
    setError("");
    try {
      const bankPayload = {
        customer_id: customerId,
        currency: "EUR",
        account_holder_name: bankData.accountHolderName,
        iban: bankData.iban,
        bank_name: bankData.bankName,
        bank_country: bankData.bankCountry,
        street: bankData.street,
        city: bankData.city,
        state: bankData.state,
        country: bankData.country,
        postal_code: bankData.postalCode,
        label: "Primary Bank Account",
      };

      let result: { data?: { id?: string } } = {};
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch(`${config.api.baseUrl}/api/iron/banks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bankPayload),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const msg = errorData.error || errorData.message || "";
          if ((msg.includes("not active") || msg.includes("Customer is not active")) && attempt < 5) {
            continue;
          }
          if (msg.includes("not active") || msg.includes("Customer is not active")) {
            throw new Error("Your account is still being activated by Iron Finance. Please wait a moment and try again.");
          }
          throw new Error(msg || "Failed to add bank account");
        }
        result = await res.json();
        break;
      }
      await updateState({
        bankAccountId: result.data?.id || "",
        bankIban: bankData.iban,
        step: "complete",
        kycCompleted: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add bank account");
    } finally {
      setLoading(false);
    }
  };

  if (!loggedIn) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-[#606060]">Sign in to begin onboarding.</p>
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#606060]" />
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="container mx-auto px-4 py-20 pb-24 max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Onboarding</h1>
        {step !== "customer" && step !== "complete" && (
          <Button variant="ghost" size="sm" onClick={handleStartOver}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Start Over
          </Button>
        )}
      </div>

      <div className="flex items-center mb-8">
        {STEPS.map(({ key, label }, i) => {
          const isCompleted = currentStepIndex > i;
          const isCurrent = step === key;
          return (
            <div key={key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    isCurrent
                      ? "bg-[#4779FF] text-white"
                      : isCompleted
                      ? "bg-green-500 text-white"
                      : "bg-[#F9F9F9] text-[#606060] border border-[#DADADA]"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className="text-xs mt-1 text-[#606060] hidden sm:block">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 ${isCompleted ? "bg-green-500" : "bg-[#DADADA]"}`} />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {step === "customer" && (
        <Card className="rounded-xl border border-[#DADADA] bg-white shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Profile</CardTitle>
                <CardDescription>We need a few details to create your account.</CardDescription>
              </div>
              {isSandbox && (
                <Button variant="outline" size="sm" onClick={() => setFormData({ firstName: "Jane", lastName: "Smith", countryCode: "DE", dateOfBirth: "1990-01-15", phoneNumber: "+4915123456789" })}>
                  Fill Test Data
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} placeholder="Jane" />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} placeholder="Smith" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Country Code</Label>
                <Input value={formData.countryCode} onChange={(e) => setFormData({ ...formData, countryCode: e.target.value.toUpperCase() })} placeholder="DE" maxLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="+49..." />
              </div>
            </div>
            <Button className="w-full bg-[#4779FF] hover:bg-[#3366ee] text-white" onClick={handleCreateCustomer} disabled={loading || !formData.firstName || !formData.lastName || !formData.dateOfBirth}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "kyc" && (
        <Card className="rounded-xl border border-[#DADADA] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Identity Verification</CardTitle>
            <CardDescription>Complete KYC to verify your identity with Iron Finance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {kycUrl ? (
              <>
                <p className="text-sm text-[#606060]">Your KYC session is ready. Complete verification in the link below.</p>
                <Button variant="outline" className="w-full" asChild>
                  <a href={kycUrl} target="_blank" rel="noopener noreferrer">Open KYC Verification</a>
                </Button>
                {isSandbox && (
                  <Button className="w-full bg-[#4779FF] hover:bg-[#3366ee] text-white" onClick={handleSandboxApproveKYC} disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sandbox: Approve KYC
                  </Button>
                )}
                <Button variant="secondary" className="w-full" onClick={handleFetchSignings} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  I&apos;ve Completed KYC →
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-[#606060]">Start KYC verification to confirm your identity.</p>
                <Button className="w-full bg-[#4779FF] hover:bg-[#3366ee] text-white" onClick={handleStartKYC} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Start KYC Verification
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === "signings" && (
        <Card className="rounded-xl border border-[#DADADA] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Sign Documents</CardTitle>
            <CardDescription>Review and sign the required terms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requiredSignings.length === 0 ? (
              <>
                <p className="text-sm text-[#606060]">Fetch required signings to continue.</p>
                <Button className="w-full bg-[#4779FF] hover:bg-[#3366ee] text-white" onClick={handleFetchSignings} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Check Required Signings
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                {requiredSignings.map((signing) => (
                  <div key={signing.id} className="rounded-xl border border-[#DADADA] p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{signing.display_name}</p>
                      {signing.url && <a href={signing.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4779FF] underline">View document</a>}
                    </div>
                    <Button size="sm" onClick={() => handleSignDocument(signing)} disabled={loading} className="bg-[#4779FF] hover:bg-[#3366ee] text-white">Sign</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "wallet" && (
        <Card className="rounded-xl border border-[#DADADA] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Register Wallet</CardTitle>
            <CardDescription>Link your embedded wallet to your Iron Finance account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#606060]">
              Your wallet address:{" "}
              <span className="font-mono text-[#030303]">
                {evmAccount?.address ? `${evmAccount.address.slice(0, 6)}...${evmAccount.address.slice(-4)}` : "Not connected"}
              </span>
            </p>
            <Button className="w-full bg-[#4779FF] hover:bg-[#3366ee] text-white" onClick={handleCreateWallet} disabled={loading || !evmAccount}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register Wallet
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "bank" && (
        <Card className="rounded-xl border border-[#DADADA] bg-white shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Add Bank Account</CardTitle>
                <CardDescription>Add your SEPA bank account for transfers.</CardDescription>
              </div>
              {isSandbox && (
                <Button variant="outline" size="sm" onClick={() => setBankData({ accountHolderName: "Jane Smith", iban: "DE89370400440532013000", bankName: "Deutsche Bank", bankCountry: "DE", street: "Hauptstraße 1", city: "Berlin", state: "Berlin", country: "DE", postalCode: "10115" })}>
                  Fill Test Data
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Account Holder Name</Label><Input value={bankData.accountHolderName} onChange={(e) => setBankData({ ...bankData, accountHolderName: e.target.value })} placeholder="Jane Smith" /></div>
            <div className="space-y-1.5"><Label>IBAN</Label><Input value={bankData.iban} onChange={(e) => setBankData({ ...bankData, iban: e.target.value })} placeholder="DE89370400440532013000" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Bank Name</Label><Input value={bankData.bankName} onChange={(e) => setBankData({ ...bankData, bankName: e.target.value })} placeholder="Deutsche Bank" /></div>
              <div className="space-y-1.5"><Label>Bank Country</Label><Input value={bankData.bankCountry} onChange={(e) => setBankData({ ...bankData, bankCountry: e.target.value.toUpperCase() })} placeholder="DE" maxLength={2} /></div>
            </div>
            <div className="border-t border-[#DADADA] pt-4">
              <p className="text-xs text-[#606060] mb-3">Account Holder Address</p>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Street</Label><Input value={bankData.street} onChange={(e) => setBankData({ ...bankData, street: e.target.value })} placeholder="Hauptstraße 1" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>City</Label><Input value={bankData.city} onChange={(e) => setBankData({ ...bankData, city: e.target.value })} placeholder="Berlin" /></div>
                  <div className="space-y-1.5"><Label>Postal Code</Label><Input value={bankData.postalCode} onChange={(e) => setBankData({ ...bankData, postalCode: e.target.value })} placeholder="10115" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>State</Label><Input value={bankData.state} onChange={(e) => setBankData({ ...bankData, state: e.target.value })} placeholder="Berlin" /></div>
                  <div className="space-y-1.5"><Label>Country</Label><Input value={bankData.country} onChange={(e) => setBankData({ ...bankData, country: e.target.value.toUpperCase() })} placeholder="DE" maxLength={2} /></div>
                </div>
              </div>
            </div>
            <Button className="w-full bg-[#4779FF] hover:bg-[#3366ee] text-white" onClick={handleAddBankAccount} disabled={loading || !bankData.accountHolderName || !bankData.iban || !bankData.bankName || !bankData.street || !bankData.city}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Bank Account
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "complete" && (
        <Card className="rounded-xl border border-[#DADADA] bg-white shadow-sm">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">All Set!</h2>
              <p className="text-sm text-[#606060]">Your account is ready. Start ramping fiat to crypto.</p>
            </div>
            <Button asChild className="w-full bg-[#4779FF] hover:bg-[#3366ee] text-white">
              <Link href="/">Go to Ramp →</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
