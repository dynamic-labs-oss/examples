/**
 * Creates and configures the single Dynamic client instance for this app.
 *
 * Imported once, at app startup (see App.tsx) — creating more than one
 * DynamicClient in the same app is unsupported by most SDK helpers, which
 * default to whichever client was created first (see `addEvmExtension`'s
 * docs: "Only required when using multiple Dynamic clients").
 */
import { createDynamicClient } from '@dynamic-labs-sdk/client';
import { APP_ORIGIN, config } from './src/consts/config';
import { addMetaMaskEvmExtension } from '@dynamic-labs-sdk/evm/metamask';

if (!config.dynamic.environmentId) {
  throw new Error(
    'DYNAMIC_ENVIRONMENT_ID is not set. Copy .env.example to .env, fill in ' +
      'your Dynamic Sandbox environment ID, and rebuild the app.',
  );
}

if (!config.dynamic.apiKey) {
  throw new Error(
    'DYNAMIC_API_KEY is not set. Copy .env.example to .env, fill in a ' +
      'sandbox API key with the flow.write scope, and rebuild the app.',
  );
}

export const dynamicClient = createDynamicClient({
  environmentId: config.dynamic.environmentId,
  ...(config.dynamic.apiBaseUrl
    ? { coreConfig: { apiBaseUrl: config.dynamic.apiBaseUrl } }
    : {}),
  logLevel: 'debug',
  metadata: {
    // Asserted non-empty by MetaMask's underlying connect SDK.
    name: 'Bare Flow MetaMask Demo',
    // Reduced to its scheme (bareflowmetamaskdemo://) and embedded in the
    // MetaMask pairing URI, so the wallet app can offer a "return to app"
    // affordance once the user approves — registered as a URL scheme in
    // ios/.../Info.plist (CFBundleURLTypes, forwarded to Linking via
    // AppDelegate.swift) and android/.../AndroidManifest.xml (intent-filter,
    // forwarded via MainActivity.kt's onNewIntent). Approval itself still
    // resolves over the SDK's own relay/session either way; this only
    // affects how smoothly the user gets back to this app.
    nativeLink: 'bareflowmetamaskdemo://',
    universalLink: APP_ORIGIN,
  },
});

addMetaMaskEvmExtension(dynamicClient);
