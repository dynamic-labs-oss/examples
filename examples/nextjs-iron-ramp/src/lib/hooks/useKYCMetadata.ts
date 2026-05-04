"use client";

import { onEvent, updateUser } from "@dynamic-labs-sdk/client";
import { useState, useEffect, useCallback, useRef } from "react";
import { dynamicClient } from "@/lib/dynamic";

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
  bankIban: string;
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
 * Uses the JS SDK's `dynamicClient.user` to read current user state and
 * `updateUser` to persist metadata. Subscribes to `userChanged` events
 * to stay in sync across tabs and after auth.
 */
export function useKYCMetadata() {
  const [state, setState] = useState<KYCState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const lastSyncedState = useRef<string>("");

  // ---------------------------------------------------------------------------
  // Load state from Dynamic user metadata
  // ---------------------------------------------------------------------------
  const loadFromUser = useCallback(() => {
    const user = dynamicClient.user;
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
  }, []);

  const syncFromClient = useCallback(() => {
    setIsLoading(true);
    const dynamicState = loadFromUser();
    if (dynamicState && dynamicState.customerId) {
      setState(dynamicState);
      lastSyncedState.current = JSON.stringify(dynamicState);
    } else {
      setState(DEFAULT_STATE);
    }
    setIsLoading(false);
  }, [loadFromUser]);

  // ---------------------------------------------------------------------------
  // Subscribe to userChanged events and init on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    syncFromClient();
    const unsub = onEvent(
      { event: "userChanged", listener: () => syncFromClient() },
      dynamicClient
    );
    const unsubLogout = onEvent(
      { event: "logout", listener: () => { setState(DEFAULT_STATE); lastSyncedState.current = ""; } },
      dynamicClient
    );
    return () => {
      unsub();
      unsubLogout();
    };
  }, [syncFromClient]);

  // ---------------------------------------------------------------------------
  // Sync state to Dynamic user metadata
  // ---------------------------------------------------------------------------
  const syncToDynamic = useCallback(async (newState: KYCState): Promise<boolean> => {
    const user = dynamicClient.user;
    if (!user) {
      console.warn("[useKYCMetadata] No user, skipping Dynamic sync");
      return false;
    }

    const stateHash = JSON.stringify(newState);
    if (stateHash === lastSyncedState.current) return true;

    try {
      const existingMetadata = (user.metadata as IronKYCMetadata) || {};
      await updateUser(
        {
          userFields: {
            metadata: {
              ...existingMetadata,
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
                  existingMetadata.iron?.createdAt || new Date().toISOString(),
              },
            },
          },
        },
        dynamicClient
      );
      lastSyncedState.current = stateHash;
      return true;
    } catch (e) {
      console.error("[useKYCMetadata] Sync failed:", e instanceof Error ? e.message : e);
      return false;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Update state and sync to Dynamic user metadata
  // ---------------------------------------------------------------------------
  const updateState = useCallback(
    async (updates: Partial<KYCState>): Promise<boolean> => {
      const newState = { ...state, ...updates };
      setState(newState);
      return await syncToDynamic(newState);
    },
    [state, syncToDynamic]
  );

  // ---------------------------------------------------------------------------
  // Reset all state
  // ---------------------------------------------------------------------------
  const reset = useCallback(async (): Promise<boolean> => {
    setState(DEFAULT_STATE);
    lastSyncedState.current = "";
    return await syncToDynamic(DEFAULT_STATE);
  }, [syncToDynamic]);

  return {
    ...state,
    isLoading,
    updateState,
    reset,
  };
}
