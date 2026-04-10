import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  client: {
    NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID: z.string().min(1),
    NEXT_PUBLIC_MG_RAMP_KEY: z.string().min(1),
    NEXT_PUBLIC_SOLANA_RPC_URL: z.string().url(),
    NEXT_PUBLIC_SOLANA_USDC_MINT: z.string().min(1),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
    NEXT_PUBLIC_MG_RAMP_KEY: process.env.NEXT_PUBLIC_MG_RAMP_KEY,
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    NEXT_PUBLIC_SOLANA_USDC_MINT: process.env.NEXT_PUBLIC_SOLANA_USDC_MINT,
  },
});
