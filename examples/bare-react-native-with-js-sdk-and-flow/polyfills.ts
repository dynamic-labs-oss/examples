/**
 * Bare React Native has none of the browser/Node globals the Dynamic SDK
 * (and the libraries it pulls in) assume exist. Expo's managed workflow
 * sets most of these up automatically; a bare RN CLI app has to do it
 * explicitly, once, before anything else runs — see index.js, which
 * imports this file first.
 *
 * This mirrors Dynamic's own bare React Native setup guide:
 * https://www.dynamic.xyz/docs/javascript/react-native/bare-react-native
 */

/**
 * Random values polyfill (crypto.getRandomValues). Provides the secure
 * native RNG the SDK relies on. Must load before anything that generates
 * random values.
 */
import 'react-native-get-random-values';

import { APP_ORIGIN } from './src/consts/config';

/**
 * Buffer polyfill for various cryptographic operations in this dependency
 * tree (viem, wallet connectors).
 */
import { Buffer as BufferPolyfill } from 'buffer';

(globalThis as typeof globalThis & { Buffer: typeof BufferPolyfill }).Buffer =
  BufferPolyfill;

/**
 * crypto.randomUUID polyfill. Hermes doesn't implement crypto.randomUUID,
 * so we generate a v4 UUID from crypto.getRandomValues (polyfilled above).
 */
type CryptoLike = {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
  randomUUID?: () => string;
};

const globalWithCrypto = globalThis as unknown as {
  crypto?: CryptoLike;
};

if (!globalWithCrypto.crypto) {
  globalWithCrypto.crypto = {};
}

const cryptoRef = globalWithCrypto.crypto;

if (typeof cryptoRef.randomUUID !== 'function') {
  cryptoRef.randomUUID = () => {
    const bytes = new Uint8Array(16);
    // getRandomValues is guaranteed by the react-native-get-random-values
    // import above.
    cryptoRef.getRandomValues!(bytes);
    // Set the version (4) and variant bits required by RFC 4122.
    /* eslint-disable no-bitwise */
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    /* eslint-enable no-bitwise */
    const hex = [...bytes]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

/**
 * window.location polyfill for Dynamic's embedded wallet support.
 * React Native has no window.location; addEvmExtension() (see
 * dynamicClient.ts) wires up Dynamic's embedded/WaaS wallet extension too
 * (it's bundled into the same call as standard wallet support), and that
 * client reads window.location.origin when loading the embedded wallet's
 * page inside the SDK's native WebView — it throws without this shim, even
 * though this demo only ever connects an external wallet (MetaMask). Uses
 * config.ts's APP_ORIGIN — the same value passed as metadata.universalLink
 * (see dynamicClient.ts) — so the embedded wallet loads with a consistent
 * origin.
 */
type MinimalLocation = {
  origin: string;
  href: string;
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
};

const globalWithLocation = globalThis as typeof globalThis & {
  location?: MinimalLocation;
};

// React Native's TypeScript config has no DOM lib, so the URL global
// (provided at runtime by React Native) needs an explicit type here.
const globalWithUrl = globalThis as typeof globalThis & {
  URL: new (url: string) => MinimalLocation;
};

if (!globalWithLocation.location) {
  const appOriginUrl = new globalWithUrl.URL(APP_ORIGIN);

  globalWithLocation.location = {
    origin: appOriginUrl.origin,
    href: appOriginUrl.href,
    protocol: appOriginUrl.protocol,
    host: appOriginUrl.host,
    hostname: appOriginUrl.hostname,
    port: appOriginUrl.port,
    pathname: appOriginUrl.pathname,
    search: appOriginUrl.search,
    hash: appOriginUrl.hash,
  };
}
