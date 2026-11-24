// Shared config for the Solana side of the demo (devnet + Circle's devnet USDC).
//
// Unlike the EVM side there is no contract for us to deploy: the Solana
// Subscriptions program (De1eg…vR44) is already live. A merchant creates a
// plan on it (see scripts/solana-create-plan.mjs) and the app lists that
// merchant's plans.

export const SOLANA_CHAIN_NAME = "Solana Devnet";
export const SOLANA_EXPLORER_CLUSTER = "devnet";

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

// Circle's devnet USDC (faucet: https://faucet.circle.com).
export const SOLANA_TOKEN_MINT =
  process.env.NEXT_PUBLIC_SOLANA_TOKEN_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const SOLANA_TOKEN_SYMBOL = "USDC";
export const SOLANA_TOKEN_DECIMALS = 6;

// The merchant whose plans the app lists. It is also the wallet the server
// collector signs as (SOLANA_MERCHANT_PRIVATE_KEY), so its plans' `pullers`
// must include it.
export const SOLANA_MERCHANT_ADDRESS = process.env.NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS || undefined;

export const solanaTxUrl = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_EXPLORER_CLUSTER}`;
export const solanaAddressUrl = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=${SOLANA_EXPLORER_CLUSTER}`;
