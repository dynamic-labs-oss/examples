import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    /** Dashboard API token used for server-to-server Dynamic API calls. */
    DYNAMIC_API_TOKEN: z.string(),
    /** HMAC secret for the wallet.delegation.* webhook. Optional locally. */
    DYNAMIC_WEBHOOK_SECRET: z.string().optional(),
    /**
     * RSA private key paired with the public key registered for delegated
     * access in the Dynamic dashboard. Required to decrypt delivered shares.
     */
    DYNAMIC_DELEGATION_PRIVATE_KEY: z.string().optional(),
    /** AES-256 key (any string; hashed to 32 bytes) encrypting stored delegation material at rest. */
    ENCRYPTION_KEY: z.string(),
    /** Shared secret gating the cron + webhook automation endpoints. */
    CRON_SECRET: z.string(),
    /** Optional Supabase backend. Falls back to a local JSON store when unset. */
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    /** RPC URL overrides per chain, e.g. RPC_URL_8453=https://mainnet.base.org */
    RPC_URL_DEFAULT: z.string().optional(),
    /** Native-token amount a native sweep leaves behind for gas. */
    DEFAULT_GAS_RESERVE: z.string().default("0.005"),
  },
  client: {
    NEXT_PUBLIC_DYNAMIC_ENV_ID: z.string(),
    NEXT_PUBLIC_DYNAMIC_API_BASE: z
      .string()
      .default("https://app.dynamicauth.com/api/v0"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_DYNAMIC_ENV_ID: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID,
    NEXT_PUBLIC_DYNAMIC_API_BASE: process.env.NEXT_PUBLIC_DYNAMIC_API_BASE,
    DYNAMIC_API_TOKEN: process.env.DYNAMIC_API_TOKEN,
    DYNAMIC_WEBHOOK_SECRET: process.env.DYNAMIC_WEBHOOK_SECRET,
    DYNAMIC_DELEGATION_PRIVATE_KEY:
      process.env.DYNAMIC_DELEGATION_PRIVATE_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RPC_URL_DEFAULT: process.env.RPC_URL_DEFAULT,
    DEFAULT_GAS_RESERVE: process.env.DEFAULT_GAS_RESERVE,
  },
});
