/**
 * Metro shim for the `ws` package.
 *
 * `ws` is a Node-only WebSocket client (its real implementation needs
 * Node's `stream`/`net` built-ins, unavailable in Hermes/React Native).
 * Something in this dependency tree resolves it transitively — WalletConnect
 * internals pulled in by @dynamic-labs-sdk/evm's wallet-connect dependency,
 * even when only MetaMask's own connector is used directly — so Metro tries
 * to bundle `ws`'s real source and fails on the Node built-ins it needs.
 *
 * This just re-exports React Native's global `WebSocket`. That's only
 * actually safe because the real consumers here (`isows`, pulled in by
 * viem, and @walletconnect/jsonrpc-ws-connection) both check for a global
 * `WebSocket` FIRST and prefer it over whatever `require('ws')` returns —
 * they never call this shim's exports directly, so its exact shape doesn't
 * matter much in practice today. It is NOT a faithful `ws` polyfill (no
 * `.on('message', ...)`-style EventEmitter API, only the browser-style
 * `WebSocket` shape) — if a future dependency in this tree calls `ws`
 * directly without that same defensive check, this will need a real
 * implementation instead, aliased in via metro.config.js's
 * resolver.resolveRequest.
 */
module.exports = global.WebSocket;
module.exports.WebSocket = global.WebSocket;
module.exports.default = global.WebSocket;
