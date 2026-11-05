#!/usr/bin/env tsx

/**
 * Delegated Wallet Gasless Transaction Demo
 *
 * Send a gasless transaction from a wallet a user has delegated to your app,
 * sponsored by Dynamic — no bundler, paymaster, or smart account involved.
 *
 * ## How this differs from a server wallet
 *
 * With a server wallet you hold the key shares, so the SDK's
 * `sendSponsoredTransaction` can sign the sponsorship intent for you.
 *
 * A delegated wallet's share stays with Dynamic behind a wallet-scoped API key,
 * so the intent has to be signed through the delegated gasless API instead —
 * `delegatedSendSponsoredTransaction`, added in SDK 1.0.106 and wrapped by
 * `src/lib/gasless/evm.ts`. The transaction still comes from the user's own
 * address — delegation changes who signs, not whose account it is.
 *
 * ## Prerequisites
 *
 * This script requires a wallet.json file with delegated access credentials.
 * See wallet.json.example for the required format.
 *
 * The delegated credentials arrive on your `wallet.delegation.created` webhook
 * when the user approves delegation in your frontend.
 *
 * Gas sponsorship must also be enabled for your environment: it is an
 * enterprise feature, toggled under Settings -> Embedded Wallets in the
 * Dynamic dashboard.
 *
 * ## Usage
 *
 *   pnpm evm:delegated:send-txn
 */

import { DEFAULT_CHAIN } from "../../../constants";
import { zeroAddress } from "viem";

import { parseArgs, runScript } from "../../lib/cli";
import { authenticatedEvmClient, delegatedEvmClient } from "../../lib/clients/evm";
import {
  sendDelegatedSponsoredTransaction,
  signDelegatedSponsoredTransaction,
} from "../../lib/gasless/evm";
import { getTransactionLink } from "../../lib/utils";
import { loadEvmDelegatedCredentials } from "./credentials";

/**
 * Step 1: Build the delegated client and send the sponsored transaction
 *
 * One client does the whole job here: the delegated client signs with the user's
 * credentials and relays in the same call. (The split-out variant below still needs
 * an API-token client for the relay half.)
 */
async function sendTransaction() {
  // Signs on the user's behalf with the credentials they delegated, then relays
  const delegatedClient = delegatedEvmClient();

  // Credentials come from your delegation webhook
  const credentials = loadEvmDelegatedCredentials();

  console.info(`\nSending gasless transaction (sponsored by Dynamic)...`);
  console.info(`Wallet: ${credentials.address}`);
  const start = Date.now();

  // Step 2: Sign the intent with delegated credentials and relay it.
  // On this wallet's first sponsored transaction the EIP-7702 delegation is
  // signed too, so expect it to take longer than subsequent ones.
  const { transactionHash } = await sendDelegatedSponsoredTransaction({
    delegatedClient,
    credentials,
    chain: DEFAULT_CHAIN,
    calls: [{ target: zeroAddress, data: "0x", value: 0n }],
  });

  // Step 3: Display results
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.info(`\nTransaction sent in ${duration}s`);
  console.info(`Hash: ${transactionHash}`);
  console.info(`Explorer: ${getTransactionLink(transactionHash)}`);

  return transactionHash;
}

/**
 * Alternative: sign now, relay later.
 *
 * `signDelegatedSponsoredTransaction` stops after signing and hands back a plain
 * JSON payload. The two halves are genuinely separable — sign in a process that
 * can reach the delegated credentials, relay from one that only needs your
 * environment API token, at any point inside `validForSeconds`.
 *
 * This is the only route to that split for a delegated wallet. The SDK's own
 * `signSponsoredTransaction` signs with caller-held key shares, which a delegated
 * wallet by definition does not have.
 *
 * Both steps run here so the demo is self-contained; in production they would sit
 * in different processes, and the payload would travel between them as JSON.
 */
async function preSignThenRelay() {
  const delegatedClient = delegatedEvmClient();
  const evmClient = await authenticatedEvmClient();
  const credentials = loadEvmDelegatedCredentials();

  console.info(`\nStep 1: signing the intent (no relay yet)...`);
  const start = Date.now();

  const signedTransaction = await signDelegatedSponsoredTransaction({
    delegatedClient,
    credentials,
    chain: DEFAULT_CHAIN,
    calls: [{ target: zeroAddress, data: "0x", value: 0n }],
    // This wallet has already been delegated by the one-shot path above, and 7702
    // delegation is permanent — so skip the check and sign with no RPC at all.
    // Don't copy this without tracking delegation state; see the option's docs.
    autoDelegate: false,
  });

  console.info(`Signed in ${((Date.now() - start) / 1000).toFixed(2)}s`);
  console.info(`\nThe payload below is plain JSON — persist it, queue it, or send`);
  console.info(`it to another service. Nothing here holds key material:`);
  // A BigInt-aware replacer is required: the payload carries `deadline`, `nonce`,
  // and each call's `value` as bigints, which JSON.stringify refuses outright.
  // Anything persisting or shipping this payload needs the same handling.
  console.info(
    JSON.stringify(
      signedTransaction,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );

  // Step 2: relay it. Only the environment API token is needed for this half.
  console.info(`\nStep 2: relaying the signed intent...`);
  const relayStart = Date.now();
  // `userId` is required on the relay half too, not just when signing: the relay
  // has to attribute a delegated wallet's transaction to its owner. Omitting it
  // fails with a bare "EVM sponsorship failed (400): Invalid request".
  const { transactionHash } = await evmClient.sendSponsoredTransaction({
    signedTransaction,
    userId: credentials.userId,
  });

  console.info(`\nRelayed in ${((Date.now() - relayStart) / 1000).toFixed(2)}s`);
  console.info(`Hash: ${transactionHash}`);
  console.info(`Explorer: ${getTransactionLink(transactionHash)}`);

  return transactionHash;
}

runScript(async () => {
  const { hasFlag } = parseArgs(process.argv);

  if (hasFlag("pre-sign")) {
    await preSignThenRelay();
    return;
  }

  await sendTransaction();
});
