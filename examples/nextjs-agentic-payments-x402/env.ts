/**
 * Environment variable configuration and validation
 *
 * Type-safe env vars via @t3-oss/env-nextjs, validated at startup.
 *
 * Server (never sent to the browser):
 * - DYNAMIC_API_TOKEN              API token for server-side Dynamic operations
 * - DYNAMIC_WEBHOOK_SECRET         Verifies Dynamic webhook signatures
 * - DYNAMIC_DELEGATION_PRIVATE_KEY RSA private key that decrypts delegation shares
 * - SUPABASE_URL                   Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY      Supabase service-role key (server only)
 * - DELEGATION_ENCRYPTION_KEY      32-byte hex AES-256-GCM key for encryption at rest
 * - X402_PAY_TO                    Address that receives x402 service payments
 * - X402_NETWORK                   "base" (mainnet, default) | "base-sepolia"
 * - CDP_API_KEY_ID / CDP_API_KEY_SECRET   Coinbase CDP keys — REQUIRED on mainnet
 *                                  (the x402 facilitator that settles on Base mainnet)
 * - BASE_RPC_URL                   Optional RPC override for balance reads
 *
 * Client (public):
 * - NEXT_PUBLIC_DYNAMIC_ENV_ID     Dynamic environment ID
 * - NEXT_PUBLIC_X402_NETWORK       Must mirror X402_NETWORK for the funding UI
 * - NEXT_PUBLIC_FAUCET_URL         Testnet faucet (used to "add funds" on base-sepolia)
 */
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DYNAMIC_API_TOKEN: z.string(),
    DYNAMIC_WEBHOOK_SECRET: z.string(),
    DYNAMIC_DELEGATION_PRIVATE_KEY: z.string(),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string(),
    DELEGATION_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, "Must be a 64-char hex string (32 bytes)"),
    X402_PAY_TO: z.string().startsWith("0x"),
    X402_NETWORK: z.enum(["base", "base-sepolia"]).default("base"),
    CDP_API_KEY_ID: z.string().optional(),
    CDP_API_KEY_SECRET: z.string().optional(),
    BASE_RPC_URL: z.string().url().optional(),
  },
  client: {
    NEXT_PUBLIC_DYNAMIC_ENV_ID: z.string(),
    NEXT_PUBLIC_X402_NETWORK: z.enum(["base", "base-sepolia"]).default("base"),
    // Hosted on-ramp URL (MoonPay / Coinbase / Crypto.com). The UI appends
    // walletAddress + baseCurrencyAmount. Leave empty on testnet to use the faucet.
    NEXT_PUBLIC_ONRAMP_URL: z.string().url().optional(),
    NEXT_PUBLIC_FAUCET_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_DYNAMIC_ENV_ID: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID,
    NEXT_PUBLIC_X402_NETWORK: process.env.NEXT_PUBLIC_X402_NETWORK,
    NEXT_PUBLIC_ONRAMP_URL: process.env.NEXT_PUBLIC_ONRAMP_URL,
    NEXT_PUBLIC_FAUCET_URL: process.env.NEXT_PUBLIC_FAUCET_URL,
    DYNAMIC_API_TOKEN: process.env.DYNAMIC_API_TOKEN,
    DYNAMIC_WEBHOOK_SECRET: process.env.DYNAMIC_WEBHOOK_SECRET,
    DYNAMIC_DELEGATION_PRIVATE_KEY: process.env.DYNAMIC_DELEGATION_PRIVATE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DELEGATION_ENCRYPTION_KEY: process.env.DELEGATION_ENCRYPTION_KEY,
    X402_PAY_TO: process.env.X402_PAY_TO,
    X402_NETWORK: process.env.X402_NETWORK,
    CDP_API_KEY_ID: process.env.CDP_API_KEY_ID,
    CDP_API_KEY_SECRET: process.env.CDP_API_KEY_SECRET,
    BASE_RPC_URL: process.env.BASE_RPC_URL,
  },
});
