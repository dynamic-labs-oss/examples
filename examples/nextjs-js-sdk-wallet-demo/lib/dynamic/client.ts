"use client";

/**
 * Dynamic SDK Client — Singleton & SSR-Safe Wrapper Factories
 *
 * This module provides the singleton Dynamic client instance and factory
 * functions for creating SSR-safe wrappers around SDK functions.
 *
 * ## Architecture
 *
 * 1. **Singleton Pattern**: Single client instance created lazily on first access
 * 2. **SSR Safety**: Returns null during server-side rendering
 * 3. **Wrapper Factories**: Two strategies for wrapping SDK functions:
 *    - `createSafeWrapper` — sync functions with a fallback value
 *    - `createAsyncSafeWrapper` — async functions that throw if client unavailable
 *
 * @see https://www.dynamic.xyz/docs/javascript/reference/client/create-dynamic-client
 */

import {
  createDynamicClient,
  type DynamicClient,
} from "@dynamic-labs-sdk/client";

import { addEvmExtension } from "@dynamic-labs-sdk/evm";
import { addSolanaExtension } from "@dynamic-labs-sdk/solana";
import { addZerodevExtension } from "@dynamic-labs-sdk/zerodev";

// =============================================================================
// SINGLETON CLIENT
// =============================================================================

let _client: DynamicClient | null = null;

/**
 * Get or create the Dynamic client instance (singleton)
 *
 * Creates the client on first access and adds all required extensions.
 * Returns null during SSR (server-side rendering).
 */
export function getClient(): DynamicClient | null {
  // SSR guard - window is undefined on server
  if (typeof window === "undefined") return null;

  if (!_client) {
    _client = createDynamicClient({
      environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID!,
      autoInitialize: true,
      metadata: {
        name: "JS SDK Wallet Demo",
      },
    });

    // Add chain extensions for EVM, Solana, and ZeroDev (gas sponsorship)
    addEvmExtension(_client);
    addSolanaExtension(_client);
    addZerodevExtension(_client);
  }

  return _client;
}

// =============================================================================
// WRAPPER FACTORIES
// =============================================================================

/**
 * Creates an SSR-safe wrapper for synchronous SDK functions.
 *
 * Returns the fallback value if:
 * - Running on server (SSR)
 * - Client not initialized
 * - Function throws an error
 *
 * @param fn - The SDK function to wrap
 * @param fallback - Value to return when function can't execute
 */
export function createSafeWrapper<T>(fn: () => T, fallback: T): () => T {
  return () => {
    const client = getClient();
    if (!client) return fallback;
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
}

/**
 * Creates an SSR-safe wrapper for async SDK functions.
 *
 * Throws an error if client is not initialized. Use this for
 * operations that should only happen after client is ready.
 *
 * @param fn - The async SDK function to wrap
 */
export function createAsyncSafeWrapper<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    const client = getClient();
    if (!client) throw new Error("Dynamic client not initialized");
    return fn(...args);
  };
}
