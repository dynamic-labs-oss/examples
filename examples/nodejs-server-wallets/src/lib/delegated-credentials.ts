/**
 * Delegated Credential Loading
 *
 * ⚠️ FOR TESTING AND DEVELOPMENT ONLY - NOT FOR PRODUCTION USE
 *
 * These examples read delegation credentials from a local wallet.json so they
 * stay runnable in isolation. In production the credentials arrive on your
 * `wallet.delegation.created` webhook and belong in a secrets manager (Vault,
 * AWS/GCP Secret Manager) — `walletApiKey` and the delegated share are both
 * sensitive, and together they can sign on the user's behalf.
 *
 * The file is read at runtime rather than `import`ed. wallet.json is gitignored,
 * so a static JSON import would make `tsc` fail on a fresh clone before the
 * example could print a useful message about how to create it.
 */

import { existsSync, readFileSync } from "node:fs";

import type { ServerKeyShare } from "@dynamic-labs-wallet/node";

/** Shape of a delegated wallet.json, as written by the developer. */
interface DelegatedWalletFile {
  /** 0x-prefixed on EVM, base58 on Solana. */
  address: string;
  walletId: string;
  walletApiKey: string;
  /** Opaque MPC key share — passed straight back to the SDK, never parsed. */
  delegatedShare: unknown;
  /** UUID of the end user who owns the wallet. Required only to sponsor gas. */
  userId?: string;
  shareSetId?: string;
}

/** Credentials a user grants when delegating their wallet to your app. */
export interface DelegatedCredentialsBase {
  address: string;
  walletId: string;
  walletApiKey: string;
  keyShare: ServerKeyShare;
  /**
   * UUID of the end user who owns this wallet — the `userId` field of the
   * delegation webhook payload.
   *
   * Optional here because plain signing (messages, typed data, transactions) does
   * not need it. The **gasless** APIs on both chains do require it: a delegated
   * wallet always belongs to an end user, so a sponsored transaction has to be
   * attributed to them rather than to the calling service. The gasless helpers
   * check for it and fail with an actionable message.
   */
  userId?: string;
  shareSetId?: string;
}

const REQUIRED_FIELDS = [
  "address",
  "walletId",
  "walletApiKey",
  "delegatedShare",
] as const;

/**
 * Load and validate delegation credentials from a wallet.json path.
 *
 * Exits with a pointer to the setup docs rather than throwing, since every
 * caller is a CLI example where a stack trace would be noise.
 *
 * @param filePath - Absolute path to the chain's wallet.json
 * @param docsPath - Repo-relative directory to reference in error messages
 */
export function loadDelegatedCredentials(
  filePath: string,
  docsPath: string,
): DelegatedCredentialsBase {
  if (!existsSync(filePath)) {
    console.error(`Delegated credentials not found: ${filePath}`);
    console.error(
      `\nCreate it from the template:\n  cp ${docsPath}/wallet.json.example ${docsPath}/wallet.json`,
    );
    console.error(`\nThen fill in the credentials from your delegation webhook.`);
    console.error(`See ${docsPath}/README.md for details.`);
    process.exit(1);
  }

  let file: DelegatedWalletFile;
  try {
    file = JSON.parse(readFileSync(filePath, "utf-8")) as DelegatedWalletFile;
  } catch (error) {
    console.error(`Could not parse ${filePath} as JSON`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const missing = REQUIRED_FIELDS.filter((key) => !file[key]);
  if (missing.length > 0) {
    console.error(
      `wallet.json is missing required field(s): ${missing.join(", ")}`,
    );
    console.error(`See ${docsPath}/wallet.json.example and ${docsPath}/README.md`);
    process.exit(1);
  }

  return {
    address: file.address,
    walletId: file.walletId,
    walletApiKey: file.walletApiKey,
    // Opaque MPC material the SDK hands out and takes back verbatim.
    keyShare: file.delegatedShare as ServerKeyShare,
    ...(file.userId && { userId: file.userId }),
    ...(file.shareSetId && { shareSetId: file.shareSetId }),
  };
}
