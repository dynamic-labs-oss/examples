"use client";

import { useUser } from "@dynamic-labs-sdk/react-hooks";
import { updateUser } from "@dynamic-labs-sdk/client";
import { useState, useEffect, useCallback, useRef } from "react";
import { dynamicClient } from "../dynamic";

// =============================================================================
// TYPES
// =============================================================================

export type OnboardStep =
  | "customer"
  | "kyc"
  | "signings"
  | "wallet"
  | "bank"
  | "complete";

export interface IronKYCMetadata {
  iron?: {
    customerId?: string;
    walletId?: string;
    walletAddress?: string;
    bankAccountId?: string;
    bankIban?: string;
    identificationId?: string;
    kycUrl?: string;
    onboardingStep?: OnboardStep;
    kycCompleted?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface KYCState {
  customerId: string;
  walletId: string;
  walletAddress: string;
  bankAccountId: string;
  bankIban: string; // The actual IBAN for the bank account
  identificationId: string;
  kycUrl: string;
  step: OnboardStep;
  kycCompleted: boolean;
}

const DEFAULT_STATE: KYCState = {
  customerId: "",
  walletId: "",
  walletAddress: "",
  bankAccountId: "",
  bankIban: "",
  identificationId: "",
  kycUrl: "",
  step: "customer",
  kycCompleted: false,
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * useKYCMetadata - Manages KYC onboarding state in Dynamic user metadata
 *
 * Single source of truth: user.metadata.iron. All state is stored there and
 * synced via updateUser(); re-run init when user/metadata changes to stay in sync.
 */
export function useKYCMetadata() {
  const user = useUser();

  const [state, setState] = useState<KYCState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);

  const lastSyncedState = useRef<string>("");

  // ---------------------------------------------------------------------------
  // Load state from Dynamic user metadata
  // ---------------------------------------------------------------------------
  const loadFromDynamic = useCallback((): KYCState | null => {
    if (!user?.metadata) return null;

    const metadata = user.metadata as IronKYCMetadata;
    if (!metadata.iron) return null;

    return {
      customerId: metadata.iron.customerId || "",
      walletId: metadata.iron.walletId || "",
      walletAddress: metadata.iron.walletAddress || "",
      bankAccountId: metadata.iron.bankAccountId || "",
      bankIban: metadata.iron.bankIban || "",
      identificationId: metadata.iron.identificationId || "",
      kycUrl: metadata.iron.kycUrl || "",
      step: metadata.iron.onboardingStep || "customer",
      kycCompleted: metadata.iron.kycCompleted || false,
    };
  }, [user?.metadata]);

  // ---------------------------------------------------------------------------
  // Sync state to Dynamic user metadata
  // ---------------------------------------------------------------------------
  const syncToDynamic = useCallback(
    async (newState: KYCState): Promise<boolean> => {
      if (!user) {
        console.warn("[useKYCMetadata] No user, skipping Dynamic sync");
        return false;
      }

      // Avoid unnecessary syncs
      const stateHash = JSON.stringify(newState);
      if (stateHash === lastSyncedState.current) {
        return true;
      }

      const metadata: IronKYCMetadata = {
        ...(user.metadata as IronKYCMetadata),
        iron: {
          customerId: newState.customerId,
          walletId: newState.walletId,
          walletAddress: newState.walletAddress,
          bankAccountId: newState.bankAccountId,
          bankIban: newState.bankIban,
          identificationId: newState.identificationId,
          kycUrl: newState.kycUrl,
          onboardingStep: newState.step,
          kycCompleted: newState.kycCompleted,
          updatedAt: new Date().toISOString(),
          createdAt:
            (user.metadata as IronKYCMetadata)?.iron?.createdAt ||
            new Date().toISOString(),
        },
      };

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 1000));
          await updateUser({ userFields: { metadata } }, dynamicClient);
          lastSyncedState.current = stateHash;
          return true;
        } catch (e) {
          if (attempt === 2) {
            console.warn("[useKYCMetadata] Sync failed after retries:", e instanceof Error ? e.message : e);
          }
        }
      }
      return false;
    },
    [user]
  );

  // ---------------------------------------------------------------------------
  // Initialize state from Dynamic user metadata (re-run when user/metadata changes)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setIsLoading(true);

    const dynamicState = loadFromDynamic();

    if (dynamicState && dynamicState.customerId) {
      setState(dynamicState);
      lastSyncedState.current = JSON.stringify(dynamicState);
    } else {
      setState(DEFAULT_STATE);
    }

    setIsLoading(false);
  }, [user?.id, user?.metadata, loadFromDynamic]);

  // ---------------------------------------------------------------------------
  // Update state and sync to Dynamic user metadata
  // ---------------------------------------------------------------------------
  const updateState = useCallback(
    async (updates: Partial<KYCState>): Promise<boolean> => {
      const newState = { ...state, ...updates };
      setState(newState);

      if (user) {
        return await syncToDynamic(newState);
      }

      return true;
    },
    [state, user, syncToDynamic]
  );

  // ---------------------------------------------------------------------------
  // Reset all state
  // ---------------------------------------------------------------------------
  const reset = useCallback(async (): Promise<boolean> => {
    setState(DEFAULT_STATE);
    lastSyncedState.current = "";

    if (user) {
      return await syncToDynamic(DEFAULT_STATE);
    }

    return true;
  }, [user, syncToDynamic]);

  return {
    ...state,
    isLoading,
    updateState,
    reset,
  };
}
