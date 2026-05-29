import { createClient } from "@dynamic-labs/client";
import { ReactNativeExtension } from "@dynamic-labs/react-native-extension";
import { SolanaExtension } from "@dynamic-labs/solana-extension";

const environmentId = process.env.EXPO_PUBLIC_DYNAMIC_ENVIRONMENT_ID as string;

/**
 * Dashboard checklist (app.dynamic.xyz/dashboard):
 *  1. SDK & App Access → add origin: http://localhost:8081
 *  2. Log In Methods → enable Email OTP
 *  3. Log In Methods → enable Google OAuth
 *     - Redirect URI to whitelist: https://auth.dynamic.xyz/oauth/callback
 *  4. Wallets → Embedded Wallets → enable Solana
 *  5. Chains → enable Solana
 */
export const dynamicClient = createClient({
  environmentId,
  appName: "MoneyGram Ramp",
})
  .extend(ReactNativeExtension({ appOrigin: "http://localhost:8081" }))
  .extend(SolanaExtension());
