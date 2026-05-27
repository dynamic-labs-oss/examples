"use client";

import { useState, useCallback, useRef } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import { signAndSendTransaction } from "@dynamic-labs-sdk/solana";
import type { SolanaWalletAccount } from "@dynamic-labs-sdk/solana";
import { dynamicClient } from "@/lib/dynamic";

const DYNAMIC_SDK_BASE = "https://app.dynamicauth.com/api/v0/sdk";
const ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!;

// ── Source token options ─────────────────────────────────────────────────────

export type SourceOption = {
  id: string;
  label: string;
  subLabel: string;
  chainName: "SOL" | "EVM";
  chainId: string;
  tokenAddress: string;
};

export const SOURCE_OPTIONS: SourceOption[] = [
  {
    id: "sol-native",
    label: "SOL",
    subLabel: "Solana",
    chainName: "SOL",
    chainId: "101",
    tokenAddress: "So11111111111111111111111111111111111111112",
  },
  {
    id: "eth-mainnet",
    label: "ETH",
    subLabel: "Ethereum",
    chainName: "EVM",
    chainId: "1",
    tokenAddress: "0x0000000000000000000000000000000000000000",
  },
  {
    id: "usdc-base",
    label: "USDC",
    subLabel: "Base",
    chainName: "EVM",
    chainId: "8453",
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
];

// ── Quote type ───────────────────────────────────────────────────────────────

export type CheckoutQuote = {
  fromAmount: string;
  fromSymbol: string;
  toAmount: string;
  toSymbol: string;
  feeUsd: string;
};

// ── Step type ────────────────────────────────────────────────────────────────

export type CheckoutStep =
  | "idle"
  | "loading"    // creating tx, setting source, fetching quote
  | "quoted"     // quote ready — waiting for user to confirm
  | "signing"    // prepare + sign + broadcast
  | "settling"   // polling for settlement
  | "completed"
  | "error";

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCheckoutFunding() {
  const [step, setStep] = useState<CheckoutStep>("idle");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Retained across the confirm call
  const txRef = useRef<{ transactionId: string; sessionToken: string } | null>(null);

  const reset = useCallback(() => {
    setStep("idle");
    setQuote(null);
    setError(null);
    txRef.current = null;
  }, []);

  // sdk helper — all calls after step 2 need the session token
  const sdk = useCallback(
    (method: string, path: string, body?: object, sessionToken?: string) =>
      fetch(`${DYNAMIC_SDK_BASE}/${ENV_ID}/${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken
            ? { "x-dynamic-checkout-session-token": sessionToken }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    []
  );

  // Run steps 1–5: create checkout config → transaction → source → risk poll → quote
  const startFunding = useCallback(
    async (
      amountUsd: number,
      fromAddress: string,
      source: SourceOption
    ) => {
      setStep("loading");
      setError(null);
      setQuote(null);
      txRef.current = null;

      try {
        // Step 1 — create checkout config (server-side, avoids exposing API token)
        const cfgRes = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: fromAddress }),
        });
        if (!cfgRes.ok) {
          const msg = (await cfgRes.json().catch(() => ({}))).error ?? "Checkout setup failed";
          throw new Error(msg);
        }
        const { checkoutId } = await cfgRes.json();

        // Step 2 — open a transaction (intentionally unauthenticated)
        const txRes = await sdk(
          "POST",
          `checkouts/${checkoutId}/transactions`,
          { amount: amountUsd }
        );
        if (!txRes.ok) throw new Error(`Transaction init failed: ${txRes.status}`);
        const txData = await txRes.json();
        const transactionId: string = txData.transactionId;
        const sessionToken: string = txData.sessionToken;
        txRef.current = { transactionId, sessionToken };

        // Step 3 — attach source wallet
        const srcRes = await sdk(
          "POST",
          `transactions/${transactionId}/source`,
          {
            fromAddress,
            fromChainId: source.chainId,
            fromChainName: source.chainName,
          },
          sessionToken
        );
        if (!srcRes.ok) throw new Error(`Source attach failed: ${srcRes.status}`);

        // Step 4 — poll risk state (cleared / not_required)
        await pollRiskState(transactionId, sessionToken);

        // Step 5 — get quote
        const quoteRes = await sdk(
          "POST",
          `transactions/${transactionId}/quote`,
          { fromTokenAddress: source.tokenAddress, slippage: 0.01 },
          sessionToken
        );
        if (!quoteRes.ok) throw new Error(`Quote failed: ${quoteRes.status}`);
        const quoteData = await quoteRes.json();

        setQuote({
          fromAmount: quoteData.fromAmount ?? quoteData.quote?.fromAmount ?? "?",
          fromSymbol: source.label,
          toAmount: quoteData.toAmount ?? quoteData.quote?.toAmount ?? String(amountUsd),
          toSymbol: "USDC",
          feeUsd: quoteData.fees?.totalFeeUsd ?? quoteData.fee?.totalFeeUsd ?? "0",
        });
        setStep("quoted");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Checkout failed";
        setError(msg);
        setStep("error");
      }
    },
    [sdk]
  );

  // Run steps 6–9: prepare → sign → broadcast → poll settlement
  const confirm = useCallback(
    async (
      walletAccount: SolanaWalletAccount,
      onSettled: () => void
    ) => {
      if (!txRef.current) return;
      const { transactionId, sessionToken } = txRef.current;

      setStep("signing");
      setError(null);

      try {
        // Step 6 — prepare (locks quote, returns signing payload)
        const prepRes = await sdk(
          "POST",
          `transactions/${transactionId}/prepare`,
          {},
          sessionToken
        );
        if (!prepRes.ok) throw new Error(`Prepare failed: ${prepRes.status}`);
        const prepData = await prepRes.json();
        const payload = prepData.quote?.signingPayload ?? prepData.signingPayload;
        if (!payload?.serializedTransaction) {
          throw new Error("No Solana signing payload returned");
        }

        // Step 7 — sign and broadcast via Dynamic embedded wallet
        const vtx = VersionedTransaction.deserialize(
          Buffer.from(payload.serializedTransaction, "base64")
        );
        const signResult = await signAndSendTransaction(
          { transaction: vtx, walletAccount },
          dynamicClient
        );
        const txHash =
          (signResult as { signature: string }).signature ??
          (signResult as unknown as string);

        // Step 8 — record broadcast
        await sdk(
          "POST",
          `transactions/${transactionId}/broadcast`,
          { txHash },
          sessionToken
        );

        // Step 9 — poll settlement
        setStep("settling");
        await pollSettlement(transactionId, sessionToken);

        setStep("completed");
        onSettled();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Payment failed";
        setError(msg);
        setStep("error");
      }
    },
    [sdk]
  );

  return { step, quote, error, startFunding, confirm, reset };

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function pollRiskState(
    transactionId: string,
    sessionToken: string
  ): Promise<void> {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const res = await sdk("GET", `transactions/${transactionId}`, undefined, sessionToken);
      if (!res.ok) throw new Error(`Risk poll failed: ${res.status}`);
      const data = await res.json();
      const state: string = data.riskState ?? "unknown";
      if (state === "cleared" || state === "not_required") return;
      if (state === "blocked") throw new Error("Wallet blocked by risk screening");
      await delay(2500);
    }
    throw new Error("Risk screening timed out");
  }

  async function pollSettlement(
    transactionId: string,
    sessionToken: string
  ): Promise<void> {
    const deadline = Date.now() + 5 * 60_000; // 5 min
    while (Date.now() < deadline) {
      const res = await sdk("GET", `transactions/${transactionId}`, undefined, sessionToken);
      if (!res.ok) throw new Error(`Settlement poll failed: ${res.status}`);
      const data = await res.json();
      const state: string = data.settlementState ?? "none";
      if (state === "completed") return;
      if (state === "failed") throw new Error("Settlement failed");
      await delay(4000);
    }
    throw new Error("Settlement timed out");
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
