/**
 * Bridges a Dynamic delegated MPC wallet into an x402 client signer.
 *
 * x402's EVM "exact" scheme is a gasless USDC payment: the payer signs an
 * EIP-3009 `transferWithAuthorization` as EIP-712 typed data, and the facilitator
 * submits it on-chain. The x402 client (x402-fetch / x402-axios) accepts a viem
 * `LocalAccount` and only ever calls `account.signTypedData(...)` for this scheme.
 *
 * So we build a viem account via `toAccount` whose `signTypedData` forwards the
 * typed-data struct to Dynamic's `delegatedSignTypedData` — meaning the private
 * key share never leaves Dynamic's MPC. No gas, no transaction, no raw key.
 *
 * Framework-agnostic (process.env only) so the standalone agent can use it.
 */
import { toAccount } from "viem/accounts";
import type { LocalAccount } from "viem";
import {
  createDelegatedEvmWalletClient,
  delegatedSignTypedData,
} from "@dynamic-labs-wallet/node-evm";
import type { ServerKeyShare } from "@dynamic-labs-wallet/node";
import type { DelegationRecord } from "./delegation-store";

/**
 * Build a viem LocalAccount backed by a Dynamic delegated wallet.
 * Only `signTypedData` is supported — that's all x402's exact scheme needs.
 */
export function createDynamicX402Account(
  delegation: DelegationRecord
): LocalAccount {
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;
  const apiKey = process.env.DYNAMIC_API_TOKEN;
  if (!environmentId || !apiKey) {
    throw new Error(
      "NEXT_PUBLIC_DYNAMIC_ENV_ID and DYNAMIC_API_TOKEN are required for delegated signing"
    );
  }

  const client = createDelegatedEvmWalletClient({ environmentId, apiKey });

  const account = toAccount({
    address: delegation.address as `0x${string}`,

    // The only method x402's "exact" EVM scheme calls.
    async signTypedData(typedData) {
      const signature = await delegatedSignTypedData(client, {
        walletId: delegation.walletId,
        walletApiKey: delegation.walletApiKey,
        keyShare: delegation.delegatedShare as ServerKeyShare,
        // typedData = { domain, types, primaryType, message }
        typedData: typedData as never,
      });
      return signature as `0x${string}`;
    },

    async signMessage() {
      throw new Error("signMessage is not used by the x402 exact scheme");
    },
    async signTransaction() {
      throw new Error(
        "signTransaction is not used by x402 (payments are gasless EIP-3009)"
      );
    },
  });

  // x402's account validation (isAccount) also requires a `sign` function.
  // viem's custom `toAccount` doesn't add one, so attach a stub — x402's exact
  // scheme only ever calls signTypedData, so this is never invoked.
  (account as unknown as { sign: () => Promise<never> }).sign = async () => {
    throw new Error("sign (raw hash) is not used by the x402 exact scheme");
  };

  return account;
}
