/**
 * Creates and configures the single Dynamic client instance for this app.
 *
 * Imported once, at app startup (see App.tsx) — creating more than one
 * DynamicClient in the same app is unsupported by most SDK helpers, which
 * default to whichever client was created first (see `addEvmExtension`'s
 * docs: "Only required when using multiple Dynamic clients").
 */
import { createDynamicClient } from '@dynamic-labs-sdk/client';
import {
  APP_ORIGIN,
  APP_SCHEME,
  PHANTOM_REDIRECT_URL,
  config,
} from './src/consts/config';
import { addMetaMaskEvmExtension } from '@dynamic-labs-sdk/evm/metamask';
import { addWalletConnectEvmExtension } from '@dynamic-labs-sdk/evm/wallet-connect';
import { addPhantomRedirectSolanaExtension } from '@dynamic-labs-sdk/solana';
import { addMetaMaskSolanaExtension } from '@dynamic-labs-sdk/solana/metamask';
import { addWalletConnectSolanaExtension } from '@dynamic-labs-sdk/solana/wallet-connect';

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
    // Shown to the user by every wallet during pairing, and required
    // non-empty by both pairing SDKs.
    name: 'Bare Flow Demo',
    // Reduced to its scheme (bareflowdemo://) and embedded in the pairing
    // URI, so the wallet app can offer a "return to app" affordance once the
    // user approves — registered as a URL scheme in ios/.../Info.plist
    // (CFBundleURLTypes, forwarded to Linking via AppDelegate.swift) and
    // android/.../AndroidManifest.xml (intent-filter, forwarded via
    // MainActivity.kt's onNewIntent). Approval itself still resolves over the
    // relay either way; this only affects how smoothly the user gets back to
    // this app.
    nativeLink: APP_SCHEME,
    universalLink: APP_ORIGIN,
  },
});

/**
 * Registers every way this app can reach an external wallet. Each pairing
 * path has to be added for its chain separately, and a chain only appears in
 * the wallet catalogue once at least one of its extensions is registered —
 * so these calls are what make EVM and Solana wallets offerable at all.
 *
 * The async ones return a promise only because they also restore sessions
 * from a previous run. Nothing waits on it: the wallets they offer are
 * registered before the promise is returned, and a restored session shows up
 * on its own once it lands.
 */
addMetaMaskEvmExtension(dynamicClient);
addMetaMaskSolanaExtension(dynamicClient);
addWalletConnectEvmExtension(dynamicClient);
addWalletConnectSolanaExtension(dynamicClient);

/**
 * Phantom on mobile is neither a WalletConnect wallet nor an in-app browser —
 * it answers by opening a URL back into this app, so it needs its own
 * extension and a redirect target to answer at.
 *
 * `disableAutoRedirectCompletion` because automatic completion reads the
 * current page URL, and there is no page here: the callback arrives through
 * `Linking` instead, which `usePhantomRedirectBridge` forwards. `onCloseTab`
 * is a no-op for the same reason — nothing opens a second tab on native.
 */
addPhantomRedirectSolanaExtension(
  {
    disableAutoRedirectCompletion: true,
    onCloseTab: () => {},
    url: new URL(PHANTOM_REDIRECT_URL),
  },
  dynamicClient,
);
