const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // `extraNodeModules` is only consulted as a *fallback*, once normal
    // resolution fails to find a module — it can't override a package
    // that's actually installed, which `ws` is (as a transitive
    // dependency). `resolveRequest` intercepts every resolution up front,
    // so it can redirect a real package too.
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'ws') {
        // `ws` is a Node-only WebSocket client that WalletConnect
        // internals pull in transitively (via @dynamic-labs-sdk/evm's
        // wallet-connect dependency, even for MetaMask-only usage) — see
        // shims/ws.js.
        return {
          type: 'sourceFile',
          filePath: path.resolve(__dirname, 'shims/ws.js'),
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
