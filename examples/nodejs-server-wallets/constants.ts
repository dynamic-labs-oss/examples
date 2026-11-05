import { config } from "dotenv";
import { baseSepolia } from "viem/chains";

config({ quiet: true });

export const DYNAMIC_API_TOKEN = process.env.DYNAMIC_API_TOKEN!;
export const DYNAMIC_ENVIRONMENT_ID = process.env.DYNAMIC_ENVIRONMENT_ID!;

/**
 * EVM RPC endpoint. **Required** for any EVM on-chain operation.
 *
 * Deliberately has no public-endpoint fallback. Falling back silently to
 * `sepolia.base.org` looks convenient but produces confusing failures: it is
 * heavily rate limited, and it returns "no backend is currently healthy to serve
 * traffic" often enough that a working setup appears broken.
 *
 * Read through a function, not a constant, so it throws only when an EVM path
 * actually needs it — the Solana examples, message signing, wallet management, and
 * the offline argument checks all run without it.
 */
export function evmRpcUrl(): string {
  const url = process.env.RPC_URL;

  if (!url) {
    throw new Error(
      "RPC_URL is required for EVM operations. Set it in .env to an endpoint you " +
        "control — see .example.env. (Solana examples and message signing do not " +
        "need it.)",
    );
  }

  return url;
}

/**
 * Default EVM chain for the examples.
 *
 * EVM-specific by construction (it is a viem chain), which is why it lives here
 * rather than in a chain-agnostic module.
 */
export const DEFAULT_CHAIN = baseSepolia;

/** USDC token decimals (standard for USDC). */
export const USDC_DECIMALS = 6;

/**
 * Solana RPC endpoint. Unlike the EVM side, this one *does* submit transactions:
 * Dynamic sponsors SVM fees by replacing the fee payer, but your server still
 * broadcasts the signed transaction itself.
 *
 * Defaults to public devnet, which is heavily rate limited.
 */
export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

/** Cluster label used for Solana explorer links. */
export const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || "devnet";

/**
 * Chain id sent with SVM transaction signing, required as of SDK 1.0.114.
 *
 * 103 is Solana devnet in the numbering these examples target. Fixed rather than
 * derived from `SOLANA_CLUSTER`: the two are separate concerns, and the cluster
 * label is only ever used for explorer links.
 *
 * A string because that is how the SDK types it for SVM — EVM takes a `number`
 * (see `chainId: chain.id` in `lib/gasless/evm.ts`). The value is metadata for the
 * signing context; the RPC and blockhash are what actually select a network, and
 * the server does not reject unknown values.
 *
 * Change this alongside `SOLANA_CLUSTER` if you point the examples at another
 * cluster — nothing enforces that they agree.
 */
export const SVM_CHAIN_ID = "103";

// Contract addresses by chain ID
export const CONTRACTS = {
  84532: { USDC: "0x678d798938bd326d76e5db814457841d055560d0" },
} as const;

/**
 * Default SPL mint for the Solana token examples: Circle's devnet USDC, 6 decimals.
 *
 * Unlike the EVM default above — a test token with an open `mint` — there is no way
 * to mint this one, so `svm:transfer-token` defaults to a 0-amount self-transfer
 * that needs no balance. Moving a non-zero amount means acquiring some first.
 */
export const SOLANA_DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const TOKEN_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "_amountDollars", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
