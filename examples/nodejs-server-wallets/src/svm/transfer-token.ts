#!/usr/bin/env tsx

/**
 * Dynamic SPL Token Transfer Demo
 *
 * Move an SPL token from a server wallet, with or without fee sponsorship.
 *
 * ## Usage
 *
 *   pnpm svm:transfer-token                                  # 0 USDC to self, wallet pays the fee
 *   pnpm svm:transfer-token --to <recipient> --amount 1.5
 *   pnpm svm:transfer-token --token <mint> --amount 10       # --mint also accepted
 *   pnpm svm:transfer-token --sponsored                      # Dynamic pays the fee
 *   pnpm svm:transfer-token --address <addr> --password xyz
 *
 * Defaults to a 0-amount self-transfer of devnet USDC. `src/svm/send-transaction.ts`
 * is the native-SOL counterpart.
 *
 * ## Where a Solana token balance lives
 *
 * Not in the wallet. Each (owner, mint) pair gets its own **associated token
 * account** (ATA), a separate account holding just that balance, at an address
 * derived from the pair. So a transfer moves value between two ATAs while the
 * wallet signs as their owner.
 *
 * Both ATAs have to exist first. Creating one costs rent, which fee sponsorship
 * does not cover — and under sponsorship the payer isn't even known until
 * sponsorship runs, so it can't be named as rent payer at build time. A missing
 * ATA is therefore an error here rather than something this script creates.
 *
 * ## Why TransferChecked rather than Transfer
 *
 * `TransferChecked` carries the expected decimals and the token program rejects
 * the instruction if they disagree with the mint. A stale decimals value fails
 * loudly instead of moving the wrong amount by a factor of ten.
 */

import { attachSignature } from "@dynamic-labs-wallet/node-svm";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  SVM_CHAIN_ID,
  SOLANA_DEVNET_USDC,
  SOLANA_RPC_URL,
} from "../../constants";
import { parseArgs, runScript } from "../lib/cli";
import {
  authenticatedSvmClient,
  getLamportBalance,
  type SvmClient,
} from "../lib/clients/svm";
import {
  broadcastSigned,
  sendSponsoredTransaction,
  signatureOf,
} from "../lib/gasless/svm";
import {
  assertDecimalAmount,
  fromBaseUnits,
  toBaseUnits,
} from "../lib/token/amount";
import { ERROR_MISSING_ATA, readSvmTokenDecimals } from "../lib/token/svm";
import { getSolanaTransactionLink } from "../lib/utils";
import { getOrCreateWallet, type WalletInfo } from "../lib/wallet-helpers";

/**
 * Build the unsigned transfer.
 *
 * v0 rather than legacy for the same reason as `src/svm/transaction.ts`: Dynamic's
 * sponsorship endpoint always returns a v0 transaction, so building v0 keeps the
 * type stable across sponsorship. `payerKey` is the sender, which sponsorship
 * replaces — the transaction still has to be well-formed before it can be sponsored.
 */
async function buildTokenTransfer({
  connection,
  sender,
  source,
  destination,
  mint,
  amountBaseUnits,
  decimals,
}: {
  connection: Connection;
  sender: PublicKey;
  source: PublicKey;
  destination: PublicKey;
  mint: PublicKey;
  amountBaseUnits: bigint;
  decimals: number;
}): Promise<VersionedTransaction> {
  // `finalized`, not `confirmed`: MPC signing and sponsorship add round trips, and
  // public RPC is load balanced, so a just-confirmed blockhash may be unknown to
  // whichever node simulates this. Surfaces as "Blockhash not found".
  const { blockhash } = await connection.getLatestBlockhash("finalized");

  const message = new TransactionMessage({
    payerKey: sender,
    recentBlockhash: blockhash,
    instructions: [
      createTransferCheckedInstruction(
        source,
        mint,
        destination,
        sender,
        amountBaseUnits,
        decimals,
      ),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

/**
 * Step 4a: Sign and broadcast with the wallet as fee payer.
 */
async function transferStandard(
  svmClient: SvmClient,
  wallet: WalletInfo,
  transaction: VersionedTransaction,
  password?: string,
) {
  console.info(`Sending SPL transfer (wallet pays the fee)...`);

  // Unsponsored, so this returns a bare signature that we attach ourselves.
  const signatureBase58 = signatureOf(
    await svmClient.signTransaction({
      walletMetadata: wallet.walletMetadata,
      ...(wallet.externalServerKeyShares.length > 0 && {
        externalServerKeyShares: wallet.externalServerKeyShares,
      }),
      transaction,
      ...(password && { password }),
      chainId: SVM_CHAIN_ID,
    }),
  );

  const signed = attachSignature({
    transaction,
    signatureBase58,
    senderAddress: wallet.address,
  });

  return broadcastSigned(signed, SOLANA_RPC_URL);
}

/**
 * Step 4b: Sponsor, sign, and broadcast.
 *
 * Dynamic swaps in its own fee payer and signs as it; your server still
 * broadcasts. Only the fee payer differs from the standard path.
 */
async function transferSponsored(
  svmClient: SvmClient,
  wallet: WalletInfo,
  transaction: VersionedTransaction,
  password?: string,
) {
  console.info(`Sending SPL transfer (sponsored by Dynamic)...`);

  return sendSponsoredTransaction({
    svmClient,
    walletMetadata: wallet.walletMetadata,
    externalServerKeyShares: wallet.externalServerKeyShares,
    transaction,
    password,
  });
}

/** A fee payer with no SOL produces an opaque RPC error, so check first. */
async function assertCanPayFee(wallet: WalletInfo) {
  const lamports = await getLamportBalance(wallet.address);

  if (lamports === 0) {
    console.error(`Wallet has no SOL and cannot pay the fee.`);
    console.error(`Address: ${wallet.address}`);
    console.error(`\nFund it, or use --sponsored which needs no balance:`);
    console.error(`  pnpm svm:transfer-token --sponsored --address ${wallet.address}`);
    process.exit(1);
  }
}

runScript(async () => {
  const { getFlag, hasFlag } = parseArgs(process.argv);

  // --mint is the Solana-native term for the same thing. Accept both so this
  // stays symmetric with the EVM script without surprising Solana users.
  const token = getFlag("token") ?? getFlag("mint") ?? SOLANA_DEVNET_USDC;
  const amount = getFlag("amount") ?? "0";
  const to = getFlag("to");
  const address = getFlag("address");
  const password = getFlag("password");
  const sponsored = hasFlag("sponsored");

  // Reject a malformed amount before creating a client or a wallet — the scale
  // needs the mint's decimals, but the format doesn't.
  assertDecimalAmount(amount);

  // Step 1: Get or create the wallet
  const svmClient = await authenticatedSvmClient();
  const wallet = await getOrCreateWallet(svmClient, address, password);

  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const sender = new PublicKey(wallet.address);
  const mint = new PublicKey(token);
  // A self-transfer is always a valid recipient, so it makes a safe default.
  const recipient = to ? new PublicKey(to) : sender;

  // Step 2: Read decimals from the mint account, then scale the amount
  console.info(`\nReading decimals for mint ${mint.toBase58()}...`);
  const decimals = await readSvmTokenDecimals(connection, mint);
  const amountBaseUnits = toBaseUnits(amount, decimals);

  console.info(`Decimals: ${decimals}`);
  console.info(
    `Amount: ${fromBaseUnits(amountBaseUnits, decimals)} (${amountBaseUnits} base units)`,
  );
  console.info(`Recipient: ${recipient.toBase58()}`);

  // Step 3: Derive both token accounts and confirm they exist
  const source = await getAssociatedTokenAddress(mint, sender);
  const destination = await getAssociatedTokenAddress(mint, recipient);
  console.info(`Source token account: ${source.toBase58()}`);
  console.info(`Destination token account: ${destination.toBase58()}`);

  if (!(await connection.getAccountInfo(source))) {
    console.error(
      `\nThis wallet has no token account for mint ${mint.toBase58()}, so it ` +
        `holds none of this token.`,
    );
    console.error(
      `Send it some first — receiving a transfer creates the account for you.`,
    );
    process.exit(1);
  }

  if (!destination.equals(source) && !(await connection.getAccountInfo(destination))) {
    console.error(`\n${ERROR_MISSING_ATA} (mint ${mint.toBase58()})`);
    process.exit(1);
  }

  if (!sponsored) await assertCanPayFee(wallet);

  const transaction = await buildTokenTransfer({
    connection,
    sender,
    source,
    destination,
    mint,
    amountBaseUnits,
    decimals,
  });

  const start = Date.now();

  // Step 4: Sign and broadcast, paying the fee from the wallet or from Dynamic
  const signature = sponsored
    ? await transferSponsored(svmClient, wallet, transaction, password)
    : await transferStandard(svmClient, wallet, transaction, password);

  // Step 5: Display results
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.info(`\nTransfer sent in ${duration}s`);
  console.info(`Signature: ${signature}`);
  console.info(`Explorer: ${getSolanaTransactionLink(signature)}`);
  console.info(`Mint: ${mint.toBase58()}`);
  console.info(`From: ${wallet.address}`);
  console.info(`To: ${recipient.toBase58()}`);
  console.info(`Fee paid by: ${sponsored ? "Dynamic sponsor" : "the wallet"}`);
});
