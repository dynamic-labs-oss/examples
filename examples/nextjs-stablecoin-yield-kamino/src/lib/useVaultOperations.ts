"use client";

import { useState } from "react";
import {
  signAndSendSponsoredTransaction,
  SponsorTransactionError,
  type SolanaWalletAccount,
} from "@dynamic-labs-sdk/solana";
import { Connection, PublicKey, VersionedTransaction, SendTransactionError } from "@solana/web3.js";
import {
  createSolanaRpc,
  createNoopSigner,
  address,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  partiallySignTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  type TransactionSigner,
} from "@solana/kit";
import { KaminoVault, type DepositIxs, type WithdrawIxs } from "@kamino-finance/klend-sdk";
import { Decimal } from "decimal.js";
import { useWallet } from "./providers";
import { dynamicClient, getSolanaRpcUrl } from "./dynamic";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

interface PreparedTransaction {
  unsigned: VersionedTransaction;
  blockhash: string;
  lastValidBlockHeight: bigint;
}

/**
 * Fetch the wallet's balance for a given token mint, checking both the
 * legacy SPL Token program and Token-2022.
 */
async function fetchTokenBalance(
  connection: Connection,
  ownerAddress: string,
  mintAddress: string
): Promise<number> {
  const owner = new PublicKey(ownerAddress);
  const mint = new PublicKey(mintAddress);

  // Legacy SPL Token program
  try {
    const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
      mint,
      programId: TOKEN_PROGRAM_ID,
    });
    if (accounts.value.length > 0) {
      return (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (accounts.value[0].account.data as any).parsed?.info?.tokenAmount
          ?.uiAmount ?? 0
      );
    }
  } catch {
    // no account in this program
  }

  // Token-2022 — filter by programId, then match mint client-side
  try {
    const mintStr = mint.toBase58();
    const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_2022_PROGRAM_ID,
    });
    const match = accounts.value.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a) => (a.account.data as any).parsed?.info?.mint === mintStr
    );
    if (match) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (match.account.data as any).parsed?.info?.tokenAmount?.uiAmount ?? 0;
    }
  } catch {
    // no Token-2022 account
  }

  return 0;
}

// Build one unsigned transaction. Each call fetches a fresh finalized blockhash so
// "Blockhash not found" can't occur during preflight simulation.
async function prepareTransaction(
  instructions: Parameters<typeof appendTransactionMessageInstructions>[0],
  noopSigner: TransactionSigner
): Promise<PreparedTransaction> {
  const rpc = createSolanaRpc(getSolanaRpcUrl());
  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: "finalized" })
    .send();

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(noopSigner, tx),
    (tx) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        tx
      ),
    (tx) => appendTransactionMessageInstructions(instructions, tx)
  );

  const compiled = await partiallySignTransactionMessageWithSigners(txMessage);
  const wireBase64 = getBase64EncodedWireTransaction(compiled);
  return {
    unsigned: VersionedTransaction.deserialize(Buffer.from(wireBase64, "base64")),
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  };
}

/**
 * Signs, sends, and confirms a transaction. Tries gas sponsorship first
 * (Dynamic covers the SOL fee); falls back to a standard signed send if the
 * environment doesn't have SVM Gas Sponsorship enabled.
 */
async function signSendAndConfirm(
  tx: VersionedTransaction,
  blockhash: string,
  lastValidBlockHeight: bigint,
  walletAccount: SolanaWalletAccount
): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { signature } = await signAndSendSponsoredTransaction(
      { transaction: tx as any, walletAccount },
      dynamicClient
    );
    const connection = new Connection(getSolanaRpcUrl(), "confirmed");
    const result = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight: Number(lastValidBlockHeight) },
      "confirmed"
    );
    if (result.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
    }
    return signature;
  } catch (err) {
    if (err instanceof SponsorTransactionError) {
      throw new Error(
        "Gas sponsorship failed. Enable SVM Gas Sponsorship in your Dynamic dashboard under Settings → Embedded Wallets."
      );
    }
    if (err instanceof SendTransactionError) {
      const connection = new Connection(getSolanaRpcUrl(), "confirmed");
      const logs = await err.getLogs(connection);
      throw new Error(
        err.message + (logs?.length ? `\n\nLogs:\n${logs.join("\n")}` : "")
      );
    }
    throw err;
  }
}

export function useVaultOperations() {
  const { solanaAccount } = useWallet();
  const [isOperating, setIsOperating] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const executeDeposit = async (
    vaultAddress: string,
    amount: number,
    tokenMint: string
  ): Promise<string | undefined> => {
    if (!solanaAccount) return;
    setIsOperating(true);
    setOperationError(null);

    try {
      const rpcUrl = getSolanaRpcUrl();
      const connection = new Connection(rpcUrl, "confirmed");
      const rpc = createSolanaRpc(rpcUrl);
      const noopSigner = createNoopSigner(address(solanaAccount.address));
      const vault = new KaminoVault(rpc, address(vaultAddress));

      // Pre-flight vault minimum check
      const vaultState = await vault.getState();
      const decimals = vaultState.tokenMintDecimals.toNumber();
      const minRaw = vaultState.minDepositAmount.toNumber();
      if (minRaw > 0) {
        const minHuman = minRaw / Math.pow(10, decimals);
        if (amount < minHuman) {
          throw new Error(
            `Amount is below the vault minimum deposit of ${minHuman.toLocaleString(undefined, { maximumFractionDigits: decimals })} tokens.`
          );
        }
      }

      // Pre-flight balance check (covers both SPL Token and Token-2022)
      const balance = await fetchTokenBalance(connection, solanaAccount.address, tokenMint);
      if (balance < amount) {
        throw new Error(
          `Insufficient balance. You have ${balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens but tried to deposit ${amount}.`
        );
      }

      const depositIxs: DepositIxs = await vault.depositIxs(noopSigner, new Decimal(amount));

      const groups = [
        depositIxs.depositIxs,
        depositIxs.stakeInFarmIfNeededIxs,
        depositIxs.stakeInFlcFarmIfNeededIxs,
      ].filter((g) => g.length > 0);

      if (groups.length === 0) return;

      // Build all transactions in parallel (independent blockhash fetches),
      // then sign, sponsor, and confirm each one sequentially.
      const prepared = await Promise.all(groups.map((g) => prepareTransaction(g, noopSigner)));

      let lastHash: string | undefined;
      for (const { unsigned, blockhash, lastValidBlockHeight } of prepared) {
        lastHash = await signSendAndConfirm(unsigned, blockhash, lastValidBlockHeight, solanaAccount);
      }
      return lastHash;
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "Deposit failed");
      throw err;
    } finally {
      setIsOperating(false);
    }
  };

  const executeWithdraw = async (
    vaultAddress: string,
    shares: number
  ): Promise<string | undefined> => {
    if (!solanaAccount) return;
    setIsOperating(true);
    setOperationError(null);

    try {
      const rpc = createSolanaRpc(getSolanaRpcUrl());
      const noopSigner = createNoopSigner(address(solanaAccount.address));
      const vault = new KaminoVault(rpc, address(vaultAddress));
      const withdrawIxs: WithdrawIxs = await vault.withdrawIxs(
        noopSigner,
        new Decimal(shares)
      );

      const groups = [
        withdrawIxs.unstakeFromFarmIfNeededIxs,
        withdrawIxs.withdrawIxs,
        withdrawIxs.postWithdrawIxs,
      ].filter((g) => g.length > 0);

      if (groups.length === 0) return;

      const prepared = await Promise.all(groups.map((g) => prepareTransaction(g, noopSigner)));

      let lastHash: string | undefined;
      for (const { unsigned, blockhash, lastValidBlockHeight } of prepared) {
        lastHash = await signSendAndConfirm(unsigned, blockhash, lastValidBlockHeight, solanaAccount);
      }
      return lastHash;
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "Withdraw failed");
      throw err;
    } finally {
      setIsOperating(false);
    }
  };

  return { isOperating, operationError, executeDeposit, executeWithdraw };
}
