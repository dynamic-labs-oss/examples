"use client";
/**
 * Dynamic Client Configuration
 *
 * This module provides a singleton Dynamic client instance with SSR compatibility.
 * It handles the initialization of Dynamic SDK with EVM extensions and provides
 * a proxy-based interface to access the client safely in both server and client environments.
 */

import {
  createDynamicClient,
  type DynamicClient,
  initializeClient,
  onEvent,
} from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";

/**
 * Private variables for lazy initialization
 *
 * We use lazy initialization to avoid creating the Dynamic client until it's actually needed,
 * and we track initialization status to ensure we don't initialize multiple times.
 */
let _dynamicClient: DynamicClient | null = null;
let _isInitialized = false;

/**
 * Gets or creates the Dynamic client instance
 *
 * This function implements a singleton pattern with lazy initialization.
 * It ensures the client is only created once and properly handles SSR scenarios.
 */
const getDynamicClient = (): DynamicClient | null => {
  // Return mock for SSR to prevent hydration mismatches
  if (typeof window === "undefined") {
    return null;
    // return createSSRMock() as DynamicClient;
  }

  // Create the client instance if it doesn't exist yet
  if (!_dynamicClient) {
    _dynamicClient = createDynamicClient({
      environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID || "",
      autoInitialize: false, // We'll handle initialization manually
      coreConfig: {
        apiBaseUrl: "https://app.dynamic-preprod.xyz/api/v0",
      },
    });
  }

  // Initialize the client only once per session
  if (!_isInitialized) {
    _isInitialized = true;

    // Start the initialization process asynchronously
    void initializeClient(_dynamicClient);

    // Wait for initialization to complete, then add EVM extension
    onEvent({
      event: "initStatusChanged",
      listener: ({ initStatus }) => {
        if (initStatus === "finished") {
          // Add EVM extension once Dynamic is fully initialized
          // This enables EVM blockchain interactions
          addEvmExtension(_dynamicClient!);
        }
      },
    });
  }

  return _dynamicClient;
};

/**
 * Exported Dynamic client proxy
 *
 * We export a proxy instead of the client directly to ensure lazy initialization.
 * The proxy intercepts all property access and calls getDynamicClient() on demand,
 * which handles SSR compatibility and proper initialization timing.
 *
 * This pattern allows components to import and use the client immediately without
 * worrying about initialization order or SSR issues.
 */
export const dynamicClient = new Proxy({} as DynamicClient, {
  get(_target, prop) {
    // Get the client instance (which may be a mock during SSR)
    const client = getDynamicClient();
    if (!client) return null;
    // Forward the property access to the actual client
    return (client as any)[prop];
  },
});
