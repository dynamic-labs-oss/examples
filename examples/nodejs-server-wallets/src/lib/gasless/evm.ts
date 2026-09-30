/**
 * Dynamic Native Gas Sponsorship (EVM)
 *
 * Dynamic sponsors gas itself — no ERC-4337 bundler, paymaster, or smart
 * account wrapper. A sponsored transaction is a batch of `{ target, data, value }`
 * calls that the wallet authorizes with an EIP-712 intent, which Dynamic's
 * relayer then submits on-chain:
 *
 *   1. The wallet's EOA is delegated (once) to Dynamic's Universal Gasless
 *      Delegate contract via an EIP-7702 authorization.
 *   2. The wallet signs an `AuthorizedExecutions` intent binding the calls to a
 *      specific relayer and a deadline.
 *   3. Dynamic's relayer broadcasts it and reports
 *      pending -> submitted -> success/failure.
 *
 * Because the wallet keeps its own address, sponsored and unsponsored
 * transactions come from the same account — unlike a smart-account approach.
 *
 * ## Two signing paths
 *
 * **Server wallets** (`sendSponsoredTransaction`) use the SDK's built-in
 * support: you hold the wallet's key shares, so `evmClient` signs the intent
 * directly.
 *
 * **Delegated wallets** (`sendDelegatedSponsoredTransaction`) use the SDK's
 * delegated gasless API, added in 1.0.106. The user's share lives with Dynamic
 * behind a wallet-scoped API key, so the delegated client signs on their behalf and
 * relays in the same call — `userId` attributes it to the wallet's owner.
 *
 * ## Requirements
 *
 * - EVM Gas Sponsorship is an enterprise feature; enable it under
 *   Settings -> Embedded Wallets in the Dynamic dashboard.
 * - Only V3 MPC embedded wallets are supported (not imported private keys).
 * - The chain must have a Dynamic relayer. Base Sepolia (84532) and Ethereum
 *   Sepolia (11155111) are the supported testnets.
 */

import type { ServerKeyShare, WalletMetadata } from "@dynamic-labs-wallet/node";
import {
  type DelegatedEvmWalletClient,
  delegatedSendSponsoredTransaction,
  type DelegatedSignSponsoredTransactionParams,
  delegatedSignSponsoredTransaction,
  type DynamicEvmWalletClient,
  type SignedSponsoredTransaction,
  type SponsoredTransactionCall,
} from "@dynamic-labs-wallet/node-evm";
import { keccak256, toHex } from "viem";
import type { Chain, Hex } from "viem";

import { DEFAULT_CHAIN, evmRpcUrl } from "../../../constants";
import type { DelegatedCredentialsBase } from "../delegated-credentials";

/** Credentials a user grants when delegating their wallet to your app. */
export interface DelegatedCredentials extends DelegatedCredentialsBase {
  /** The delegated wallet's address — this is the account that transacts. */
  address: Hex;
}

interface ChainOptions {
  /** Chain to transact on. Must have a Dynamic relayer. */
  chain?: Chain;
  /** Read-only RPC used for delegation status, EOA nonces, and nonce checks. */
  rpcUrl?: string;
}

/** Parameters for sponsoring from a server wallet you hold key shares for. */
export interface SendSponsoredTransactionOptions extends ChainOptions {
  evmClient: DynamicEvmWalletClient;
  walletMetadata: WalletMetadata;
  /** Omit when the shares are backed up to Dynamic and recovered by password. */
  externalServerKeyShares?: ServerKeyShare[];
  calls: SponsoredTransactionCall[];
  password?: string;
  /** Relay on behalf of an end user instead of the API token's service user. */
  userId?: string;
  /**
   * Single-use bitmap nonce for the intent.
   *
   * **Omit this and every call gets a fresh random nonce** — so two calls
   * describing the same logical operation are two distinct intents, and *both*
   * can land on-chain. Pass a stable value derived from your own idempotency key
   * (see `deriveIdempotencyNonce`) to make retries safe.
   */
  nonce?: bigint;
}

/**
 * Parameters for sponsoring from a wallet a user delegated to you.
 *
 * No API-token client here: the delegated client signs *and* relays. `userId`
 * travels on `credentials`, since it arrives on the same delegation webhook.
 */
export interface SendDelegatedSponsoredTransactionOptions extends ChainOptions {
  /** Delegated client, used to sign with the user's delegated share. */
  delegatedClient: DelegatedEvmWalletClient;
  credentials: DelegatedCredentials;
  calls: SponsoredTransactionCall[];
  /** How long the signed intent stays valid. Defaults to 10 minutes. */
  validForSeconds?: number;
  /**
   * Sign the one-time EIP-7702 authorization when the wallet isn't delegated yet.
   * Defaults to true.
   *
   * Leaving it on costs one `eth_getCode` read per call, to decide whether the
   * authorization is needed. Set it to false **only if you already know the wallet
   * is delegated** — that fact is permanent once true, so recording it per
   * wallet-and-chain when the first sponsored transaction succeeds lets later calls
   * skip the read, and removes the RPC from the path entirely.
   *
   * Don't set it to false speculatively: an undelegated wallet's intent will fail.
   */
  autoDelegate?: boolean;
  /**
   * Single-use bitmap nonce. Omit and a fresh random one is generated per call,
   * which makes retries unsafe. See `deriveIdempotencyNonce`.
   */
  nonce?: bigint;
}

/**
 * Send a gasless transaction from a server wallet you hold key shares for.
 *
 * The SDK signs the intent, resolves the one-time EIP-7702 delegation, relays
 * it, and polls until it lands on-chain.
 */
export async function sendSponsoredTransaction({
  evmClient,
  walletMetadata,
  externalServerKeyShares,
  calls,
  password,
  userId,
  nonce,
  chain = DEFAULT_CHAIN,
  rpcUrl = evmRpcUrl(),
}: SendSponsoredTransactionOptions): Promise<{ transactionHash: Hex }> {
  return evmClient.sendSponsoredTransaction({
    walletMetadata,
    // Pass shares only when we hold them. When they're backed up to Dynamic,
    // omitting them lets the SDK recover them using the password.
    ...(externalServerKeyShares?.length ? { externalServerKeyShares } : {}),
    calls,
    chainId: chain.id,
    // rpcUrl lets the SDK check delegation state and auto-sign the EIP-7702
    // authorization on the wallet's first sponsored transaction.
    rpcUrl,
    ...(password && { password }),
    ...(userId && { userId }),
    ...(nonce !== undefined && { nonce }),
  });
}


/**
 * Send a gasless transaction from a delegated wallet.
 *
 * A first-class SDK API as of 1.0.106: it signs the EIP-712 intent with the user's
 * delegated share, resolves the one-time EIP-7702 authorization when the wallet is
 * not yet delegated, relays it, and polls until it lands. The plain
 * `signSponsoredTransaction` can't do this — it signs with caller-held key shares,
 * which a delegated wallet by definition does not have.
 *
 * Note `userId` is required, and comes from the delegation webhook: a delegated
 * wallet always belongs to an end user, so the relay is attributed to them rather
 * than to the calling service.
 */
export async function sendDelegatedSponsoredTransaction(
  options: SendDelegatedSponsoredTransactionOptions,
): Promise<{ transactionHash: Hex }> {
  return delegatedSendSponsoredTransaction(
    options.delegatedClient,
    delegatedGaslessParams(options),
  );
}

/**
 * Sign a delegated wallet's sponsorship intent without relaying it.
 *
 * The result is a plain JSON payload, so signing and relaying can live in different
 * processes: hold it and submit it later with
 * `sendSponsoredTransaction({ signedTransaction })`, which needs only your
 * environment API token and no wallet key material.
 */
export async function signDelegatedSponsoredTransaction(
  options: SendDelegatedSponsoredTransactionOptions,
): Promise<SignedSponsoredTransaction> {
  return delegatedSignSponsoredTransaction(
    options.delegatedClient,
    delegatedGaslessParams(options),
  );
}

/**
 * Map this repo's option shape onto the SDK's parameter shape.
 *
 * `autoDelegate` defaults to true: sign the one-time 7702 authorization on a
 * wallet's first sponsored transaction rather than making the caller sequence it.
 * Use `delegatedSign7702Authorization` if you want that step explicit.
 *
 * `autoDelegate` is the sole reason this path needs an RPC, so the URL is resolved
 * only when it's on. Note this has to stay lazy: `evmRpcUrl()` throws when
 * `RPC_URL` is unset, and a destructuring default would fire that even with
 * `autoDelegate: false` — which is exactly the case that needs no RPC.
 */
function delegatedGaslessParams({
  credentials,
  calls,
  nonce,
  validForSeconds,
  autoDelegate = true,
  chain = DEFAULT_CHAIN,
  rpcUrl,
}: SendDelegatedSponsoredTransactionOptions): DelegatedSignSponsoredTransactionParams {
  return {
    walletId: credentials.walletId,
    walletApiKey: credentials.walletApiKey,
    keyShare: credentials.keyShare,
    walletAddress: credentials.address,
    userId: requireUserId(credentials),
    ...(credentials.shareSetId && { shareSetId: credentials.shareSetId }),
    calls,
    chainId: chain.id,
    // Only needed for the delegation check and the EOA nonce that a 7702
    // authorization commits to — both are reads, and both are skippable when
    // autoDelegate is off.
    ...(autoDelegate && { rpcUrl: rpcUrl ?? evmRpcUrl() }),
    autoDelegate,
    ...(nonce !== undefined && { nonce }),
    ...(validForSeconds !== undefined && { validForSeconds }),
  };
}


/**
 * Derive a stable 256-bit intent nonce from an application-level idempotency key.
 *
 * The delegate contract tracks spent nonces in a bitmap, so a nonce is consumable
 * exactly once per wallet. Deriving it from something like an order ID means every
 * retry of that logical operation produces the *same* nonce, and at most one
 * attempt can ever land.
 *
 * Stronger than persisting a signed intent and replaying it, because it survives
 * re-signing — which matters since intents expire (10 minutes by default), so a
 * long retry window forces a re-sign, and a re-sign without a fixed nonce silently
 * loses the guarantee.
 *
 * keccak256 gives a uniformly distributed 256-bit value, exactly the nonce width.
 *
 * EVM-only: SVM has no nonce, and there the signed bytes are the idempotency unit.
 * See IDEMPOTENCY.md.
 *
 * @param key - Stable identifier for the operation, e.g. `order:12345`. Unique per
 *              intended execution, identical across retries.
 */
export function deriveIdempotencyNonce(key: string): bigint {
  return BigInt(keccak256(toHex(key)));
}

/**
 * Sponsorship needs the wallet owner's `userId`; plain signing does not.
 *
 * Checked here rather than when loading credentials, so message and typed-data
 * signing keep working on a `wallet.json` that predates this requirement.
 */
function requireUserId(credentials: DelegatedCredentials): string {
  if (!credentials.userId) {
    throw new Error(
      "userId is required to sponsor a delegated transaction — a delegated wallet " +
        "is always owned by an end user, so the relay has to be attributed to them. " +
        "Add the `userId` from your wallet.delegation.created webhook to wallet.json.",
    );
  }

  return credentials.userId;
}
