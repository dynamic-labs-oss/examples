"use client";

import type { DynamicClient } from "@dynamic-labs-sdk/client";
import { onEvent } from "@dynamic-labs-sdk/client";
import { useRef, useSyncExternalStore } from "react";

import { dynamicClient } from "../components/dynamicClient";

/**
 * Custom hooks for accessing Dynamic client state in React components.
 *
 * These hooks provide reactive access to Dynamic client data and automatically
 * re-render components when the underlying data changes.
 */

/**
 * Generic hook for subscribing to Dynamic client state changes.
 *
 * @param eventName - The name of the Dynamic event to listen for
 * @param getSnapshot - Function that extracts the desired data from the client
 * @param fallbackValue - Value to return if client is unavailable or during SSR
 * @returns The current value of the state, automatically updating when it changes
 */
export const useDynamicClientState = <T>(
  eventName: keyof DynamicEvents,
  getSnapshot: (client: DynamicClient) => T,
  fallbackValue?: T,
): T => {
  // Safely get initial value - only call getSnapshot if client is available
  const getInitialValue = (): T => {
    try {
      const client = dynamicClient;
      if (!client) return fallbackValue as T;
      return getSnapshot(client);
    } catch (error) {
      return fallbackValue as T;
    }
  };

  const valueRef = useRef<T>(getInitialValue());

  return useSyncExternalStore(
    (onStoreChange: VoidFunction) => {
      try {
        return onEvent({
          event: eventName,
          listener: () => {
            try {
              const client = dynamicClient;
              if (client) {
                valueRef.current = getSnapshot(client);
              } else {
                valueRef.current = fallbackValue as T;
              }
              onStoreChange();
            } catch (error) {
              console.warn(`Error updating ${eventName}:`, error);
              valueRef.current = fallbackValue as T;
              onStoreChange();
            }
          },
        });
      } catch (error) {
        return () => {}; // Return no-op cleanup function
      }
    },
    () => valueRef.current,
    () => fallbackValue as T, // Server snapshot fallback
  );
};
