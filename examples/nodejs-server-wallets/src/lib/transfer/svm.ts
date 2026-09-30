/**
 * Solana Transfer Adapter
 *
 * Implements `ChainTransferAdapter` for SVM. Imports only Solana dependencies —
 * the EVM adapter is a sibling and the two never reference each other.
 *
 * ## Idempotency on SVM
 *
 * There is no nonce to pin. A rebuild takes a fresh blockhash, which changes the
 * message and therefore the transaction id — a second execution. So the guarantee
 * is the **signed bytes**: sign once, persist them, and rebroadcast those verbatim
 * on retry. Solana dedups identical signatures, so a rebroadcast cannot execute
 * twice.
 *
 * Note the transaction id is `signatures[0]`, the *fee payer's* signature — the
 * sponsor's, here. So re-signing the wallet's `signatures[1]` does not produce a
 * second executable transaction, even though MPC signing is non-deterministic.
 * Rebuilding is the vector; measurements in IDEMPOTENCY.md.
 *
 * That inverts the EVM rule, where re-signing is safe as long as the nonce is
 * pinned. Getting either backwards double-spends.
 */

import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { SOLANA_RPC_URL } from "../../../constants";
import {
  broadcastSigned,
  type DelegatedCredentials,
  resolvePriorBroadcast,
  serializeSigned,
  signDelegatedSponsoredTransaction,
  signSponsoredTransaction,
} from "../gasless/svm";
import { ERROR_MISSING_ATA, readSvmTokenDecimals } from "../token/svm";
import { patchTransfer, putTransfer } from "./store";
import {
  assertDecimalsMatch,
  assertUnsupportedSigner,
  type ChainTransferAdapter,
  NATIVE_DECIMALS,
  requireClient,
  type TransferExecution,
  type TransferRequest,
  type TransferResult,
} from "./types";
import { getSolanaTransactionLink } from "../utils";

/** SVM implementation of the transfer contract. */
export const svmTransferAdapter: ChainTransferAdapter = {
  resolveDecimals,
  transfer,
  explorerUrl: getSolanaTransactionLink,
};

async function resolveDecimals(request: TransferRequest): Promise<number> {
  if (request.asset.kind === "native") return NATIVE_DECIMALS.svm;

  const connection = new Connection(
    request.rpcUrl ?? SOLANA_RPC_URL,
    "confirmed",
  );
  const onChain = await readSvmTokenDecimals(connection, request.asset.address);

  return assertDecimalsMatch({
    address: request.asset.address,
    asserted: request.asset.decimals,
    onChain,
  });
}

async function transfer(
  request: TransferRequest,
  { amountBaseUnits, decimals, prior }: TransferExecution,
): Promise<TransferResult> {
  const rpcUrl = request.rpcUrl ?? SOLANA_RPC_URL;

  // A previous attempt already signed this transfer: resolve it, don't rebuild.
  // Rebuilding would take a fresh blockhash — a new transaction id, and a second
  // execution.
  if (prior?.signedTransaction) {
    const signature = await resolvePriorBroadcast({
      signedTransaction: prior.signedTransaction,
      recordedSignature: prior.transactionId,
      rpcUrl,
    });
    patchTransfer(request.idempotencyKey, {
      status: "success",
      transactionId: signature,
    });

    return {
      chain: "svm",
      transactionId: signature,
      explorerUrl: getSolanaTransactionLink(signature),
      amountBaseUnits,
      executed: false,
    };
  }

  const transaction = await buildTransaction({
    request,
    amount: amountBaseUnits,
    decimals,
    rpcUrl,
  });

  const signed = await sign(request, transaction);

  // Persist before broadcasting. Crashing after the send but before the write
  // would strand a transaction that could never be retried safely.
  putTransfer({
    key: request.idempotencyKey,
    chain: "svm",
    status: "pending",
    from: request.from,
    to: request.to,
    signedTransaction: serializeSigned(signed),
    createdAt: new Date().toISOString(),
  });

  const signature = await broadcastSigned(signed, rpcUrl);

  patchTransfer(request.idempotencyKey, {
    status: "success",
    transactionId: signature,
  });

  return {
    chain: "svm",
    transactionId: signature,
    explorerUrl: getSolanaTransactionLink(signature),
    amountBaseUnits,
    executed: true,
  };
}

/**
 * Sponsor and sign with whichever signer the caller supplied.
 *
 * Both paths sponsor before signing — replacing the fee payer changes the message,
 * so the order is not interchangeable.
 */
async function sign(
  request: TransferRequest,
  transaction: VersionedTransaction,
) {
  const svmClient = requireClient(request.clients.svmClient, "svmClient");
  const signer = request.signer;

  switch (signer.kind) {
    case "server":
      return signSponsoredTransaction({
        svmClient,
        walletMetadata: signer.walletMetadata,
        externalServerKeyShares: signer.externalServerKeyShares,
        password: signer.password,
        transaction,
      });

    case "delegated":
      return signDelegatedSponsoredTransaction({
        delegatedClient: requireClient(
          request.clients.svmDelegatedClient,
          "svmDelegatedClient",
        ),
        credentials: signer.credentials as DelegatedCredentials,
        transaction,
      });

    default:
      return assertUnsupportedSigner(signer);
  }
}

async function buildTransaction({
  request,
  amount,
  decimals,
  rpcUrl,
}: {
  request: TransferRequest;
  amount: bigint;
  decimals: number;
  rpcUrl: string;
}): Promise<VersionedTransaction> {
  const connection = new Connection(rpcUrl, "confirmed");
  const sender = new PublicKey(request.from);
  const recipient = new PublicKey(request.to);

  const instructions =
    request.asset.kind === "native"
      ? [
          SystemProgram.transfer({
            fromPubkey: sender,
            toPubkey: recipient,
            lamports: amount,
          }),
        ]
      : await buildSplTransfer({
          connection,
          mint: new PublicKey(request.asset.address),
          decimals,
          sender,
          recipient,
          amount,
        });

  // `finalized`, not `confirmed`: sponsorship and MPC signing add round trips, and
  // public RPC is load balanced, so a just-confirmed blockhash may be unknown to
  // whichever node simulates the transaction.
  const { blockhash } = await connection.getLatestBlockhash("finalized");

  // v0, not legacy: Dynamic's sponsorship endpoint always returns a versioned
  // transaction, and the SDK deserializes based on what you sent it.
  const message = new TransactionMessage({
    payerKey: sender,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

async function buildSplTransfer({
  connection,
  mint,
  decimals,
  sender,
  recipient,
  amount,
}: {
  connection: Connection;
  mint: PublicKey;
  decimals: number;
  sender: PublicKey;
  recipient: PublicKey;
  amount: bigint;
}): Promise<TransactionInstruction[]> {
  const source = await getAssociatedTokenAddress(mint, sender);
  const destination = await getAssociatedTokenAddress(mint, recipient);

  // Creating the recipient's ATA costs rent, which the fee sponsor does not cover
  // — and the sponsor's address isn't even known until sponsorship runs, so it
  // can't be named as rent payer at build time. Fail with something actionable
  // rather than emitting a transaction that reverts.
  if (!(await connection.getAccountInfo(destination))) {
    throw new Error(`${ERROR_MISSING_ATA} (mint ${mint.toBase58()})`);
  }

  return [
    createTransferCheckedInstruction(
      source,
      mint,
      destination,
      sender,
      amount,
      decimals,
    ),
  ];
}
