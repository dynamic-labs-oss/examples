/**
 * Environment Variables
 *
 * Server-side and client-side environment variables
 */

export const env = {
  // Iron Finance
  IRON_ENVIRONMENT: (process.env.IRON_ENVIRONMENT as "production" | "sandbox") || "sandbox",
  IRON_API_KEY: process.env.IRON_API_KEY || "",

  // Dynamic
  NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || "",
} as const;
