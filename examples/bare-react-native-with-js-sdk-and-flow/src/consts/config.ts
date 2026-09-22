/**
 * Centralized env var reads. Values are inlined into the JS bundle at build
 * time by babel-plugin-transform-inline-environment-variables (see
 * babel.config.js) — there's no Expo-style EXPO_PUBLIC_* substitution in a
 * bare React Native app, so this is the equivalent mechanism.
 *
 * Copy .env.example to .env and fill it in before running the app.
 */
/**
 * Placeholder — this demo has no real hosted domain. Used both as the
 * origin for Dynamic's embedded-wallet WebView (polyfills.ts's
 * window.location shim) and as `metadata.universalLink` (dynamicClient.ts).
 * Shared here so the two stay in sync automatically; replace with your
 * app's actual domain in production.
 */
export const APP_ORIGIN = 'https://example.com';

export const config = {
  dynamic: {
    /** Required. https://app.dynamic.xyz/dashboard/developer/api */
    environmentId: process.env.DYNAMIC_ENVIRONMENT_ID,
    /** Optional. Empty/undefined lets the SDK use its own default (production). */
    apiBaseUrl: process.env.DYNAMIC_API_BASE_URL || 'https://app.dynamicauth.com/api/v0',
    /**
     * Sandbox-only Dynamic API key (flow.write scope) — see .env.example.
     * Used directly by src/utils/createDepositFlow.ts and
     * src/utils/createWithdrawFlow.ts to create Flows server-side.
     */
    apiKey: process.env.DYNAMIC_API_KEY,
  },
} as const;
