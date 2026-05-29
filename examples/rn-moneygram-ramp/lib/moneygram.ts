/**
 * MoneyGram xRamps — local transaction history.
 *
 * The widget issues a `referenceNumber` when an off-ramp completes — that's what
 * the recipient presents at a MoneyGram agent location to collect cash. We persist
 * each transaction locally so the user can reopen it later in "view mode" to check
 * its live status or request a refund (both handled inside the MoneyGram widget).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface MgiRecord {
  id: string; // Ramps transactionId — needed to reopen in view mode
  referenceNumber: string; // Shown to recipient at the MoneyGram agent location
  amount: string; // USDC amount sent on-chain
  asset: "USDC";
  createdAt: number; // unix ms
}

// Key by transaction id so each transaction maps to a single record — completing
// the same transaction again updates it in place instead of writing a duplicate.
const KEY_PREFIX = "mgi_tx_";
const keyFor = (id: string) => `${KEY_PREFIX}${id}`;

export async function saveRecord(record: MgiRecord): Promise<void> {
  const key = keyFor(record.id);
  const existingRaw = await AsyncStorage.getItem(key);
  let merged = record;
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw) as MgiRecord;
      // Keep the original timestamp; keep the existing amount/reference if a
      // later event omits them.
      merged = {
        ...existing,
        referenceNumber: record.referenceNumber || existing.referenceNumber,
        amount:
          Number.parseFloat(record.amount) > 0 ? record.amount : existing.amount,
        createdAt: existing.createdAt,
      };
    } catch {
      // Existing entry is corrupt — overwrite it with the new record.
    }
  }
  await AsyncStorage.setItem(key, JSON.stringify(merged));
}

export async function loadAllRecords(): Promise<MgiRecord[]> {
  const keys = await AsyncStorage.getAllKeys();
  const mgKeys = keys.filter((k) => k.startsWith(KEY_PREFIX));
  if (mgKeys.length === 0) return [];
  const entries = await AsyncStorage.multiGet(mgKeys);
  const records: MgiRecord[] = [];
  for (const [, value] of entries) {
    if (!value) continue;
    try {
      records.push(JSON.parse(value) as MgiRecord);
    } catch {
      // Skip corrupt entries rather than crashing the history screen.
    }
  }
  return records.sort((a, b) => b.createdAt - a.createdAt);
}
