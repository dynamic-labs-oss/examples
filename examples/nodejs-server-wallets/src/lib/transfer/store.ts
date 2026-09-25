/**
 * Transfer Idempotency Store
 *
 * ⚠️ FOR TESTING AND DEVELOPMENT ONLY - NOT FOR PRODUCTION USE
 *
 * Backs the unified transfer layer. One record per idempotency key, tagged by
 * chain, because the two chains need different things persisted:
 *
 *   EVM - the derived nonce and relay `requestId`. The nonce is reproducible from
 *         the key, so this is bookkeeping rather than the guarantee itself.
 *   SVM - the **signed transaction bytes**. These are load-bearing: rebuilding
 *         takes a fresh blockhash, which changes the transaction id and executes
 *         again. Rebroadcasting the stored bytes is the only safe retry.
 *
 * In production this belongs in your transactional datastore, written alongside
 * the business record that triggered the transfer. See IDEMPOTENCY.md.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { TransferRecord } from "./types";

const STORE_FILE = join(process.cwd(), ".transfers.json");

type Store = Record<string, TransferRecord>;

function load(): Store {
  if (!existsSync(STORE_FILE)) return {};

  try {
    return JSON.parse(readFileSync(STORE_FILE, "utf-8"));
  } catch (error) {
    console.warn("Failed to load transfer store:", error);
    return {};
  }
}

function write(store: Store): void {
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

/** Look up a prior attempt for this idempotency key. */
export function getTransfer(key: string): TransferRecord | undefined {
  return load()[key];
}

/**
 * Create or update a record.
 *
 * A record that has settled as `success` is immutable — later attempts under the
 * same key cannot overwrite or downgrade it. Losing that fact is worse than never
 * storing it, since the next run would re-dispatch completed work.
 */
export function putTransfer(record: TransferRecord): void {
  const store = load();
  const existing = store[record.key];

  if (existing?.status === "success") return;

  store[record.key] = record;
  write(store);
}

/**
 * Patch an existing record, subject to the same immutability rule.
 *
 * The rule protects the settled **status** only. A disallowed status is dropped
 * from the patch rather than discarding the whole patch: a caller writing
 * `{ status, transactionId }` should still get its `transactionId` recorded, since
 * losing the transaction id of a settled operation makes it unresolvable.
 */
export function patchTransfer(
  key: string,
  updates: Partial<Omit<TransferRecord, "key">>,
): void {
  const store = load();
  const existing = store[key];
  if (!existing) return;

  const { status, ...rest } = updates;
  const statusAllowed = existing.status !== "success" || status === "success";

  store[key] = {
    ...existing,
    ...rest,
    ...(statusAllowed && status !== undefined && { status }),
  };
  write(store);
}
