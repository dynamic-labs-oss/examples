"use client";

/**
 * SDK Events
 *
 * Subscribe to Dynamic SDK events for reactive updates
 * (e.g., auth state changes, wallet changes).
 *
 * @see https://dynamic.xyz/docs/javascript/reference/client/on-event
 */

import {
  onEvent as sdkOnEvent,
  offEvent as sdkOffEvent,
} from "@dynamic-labs-sdk/client";

/**
 * Subscribe to a Dynamic SDK event.
 *
 * @example
 * ```ts
 * const unsub = onEvent({
 *   event: "walletAccountsChanged",
 *   listener: () => refetchWallets()
 * });
 * // Later: unsub();
 * ```
 *
 * @see https://dynamic.xyz/docs/javascript/reference/client/on-event
 */
export const onEvent = sdkOnEvent;

/** Unsubscribe from a Dynamic SDK event */
export const offEvent = sdkOffEvent;
