/**
 * Typed client for the vaults.fyi v2 API.
 *
 * The SDK is configured with `apiBaseUrl` pointing at the local Next.js
 * proxy (/api/vaultsfyi) which attaches the x-api-key header server-side.
 * The vaults.fyi key never reaches the browser bundle.
 *
 * Spec: https://docs.vaults.fyi/sdk/reference
 * OpenAPI: https://api.vaults.fyi/v2/documentation/json
 */

import { VaultsSdk } from "@vaultsfyi/sdk";

export const sdk = new VaultsSdk(
  { apiKey: "proxied" },
  {
    apiBaseUrl:
      typeof window !== "undefined"
        ? `${window.location.origin}/api/vaultsfyi`
        : "/api/vaultsfyi",
  },
);
