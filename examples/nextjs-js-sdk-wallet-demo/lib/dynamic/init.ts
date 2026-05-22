"use client";

/**
 * Client Initialization
 *
 * Check and wait for the Dynamic client to finish initializing.
 * Useful for showing loading states and gating operations.
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/client/initialize-dynamic-client
 */

import { waitForClientInitialized as sdkWaitForClientInitialized } from "@dynamic-labs-sdk/client";
import { getClient } from "./client";

/** Possible initialization states for the Dynamic client */
export type InitStatus =
  | "uninitialized"
  | "in-progress"
  | "finished"
  | "failed";

/**
 * Get current client initialization status.
 * Returns "uninitialized" during SSR.
 */
export function getInitStatus(): InitStatus {
  const client = getClient();
  if (!client) return "uninitialized";
  return client.initStatus as InitStatus;
}

/**
 * Wait for client to finish initializing.
 * Useful before operations that require full client state.
 */
export async function waitForClientInitialized(): Promise<void> {
  const client = getClient();
  if (!client) return;
  return sdkWaitForClientInitialized(client);
}
