/**
 * Supabase-backed store for delegated wallet credentials, with application-level
 * AES-256-GCM encryption at rest.
 *
 * Framework-agnostic: reads config from process.env and uses only npm packages,
 * so both the Next.js app (webhook handler) and the standalone agent import it.
 *
 * Flow:
 *  - Dynamic's webhook delivers the delegated share + wallet API key, RSA-encrypted
 *    to our public key. The webhook handler decrypts that (see lib/dynamic/delegation/decrypt).
 *  - Before persisting, we re-encrypt the sensitive material with AES-256-GCM using
 *    DELEGATION_ENCRYPTION_KEY so the database never holds plaintext key shares.
 *  - On read we decrypt in memory just long enough to sign.
 *
 * Security notes:
 *  - DELEGATION_ENCRYPTION_KEY and SUPABASE_SERVICE_ROLE_KEY must come from a secrets
 *    manager / env, never hardcoded. For production prefer a KMS/HSM-managed key and
 *    decrypt on-demand (this AES-GCM-from-env approach is a sane demo default).
 *  - The plaintext share is never logged or returned to the browser.
 */
import crypto from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DELEGATION_CHAIN } from "./constants";

/** Everything needed to sign on behalf of a user's delegated wallet. */
export interface DelegationRecord {
  /** Dynamic user id. */
  userId: string;
  /** Chain identifier (e.g. "EVM"). */
  chain: string;
  /** Dynamic wallet id. */
  walletId: string;
  /** The wallet's EVM address. */
  address: string;
  /** Short, stable account code that maps to this wallet (derived on store; always set on reads). */
  code?: string;
  /** Decrypted MPC key share (Dynamic ServerKeyShare / EcdsaKeygenResult). */
  delegatedShare: unknown;
  /** Decrypted wallet API key for Dynamic delegated signing. */
  walletApiKey: string;
}

/**
 * Derive a short, stable account code from a wallet address. Deterministic
 * (no DB round-trip, stable across re-delegations) and collision-resistant
 * (40 bits). This is the user↔wallet handle the agent resolves against —
 * it is NOT a secret and does not grant access to funds (the signing creds
 * stay encrypted in Supabase, only the server can decrypt them).
 */
export function deriveAccountCode(address: string): string {
  return crypto
    .createHash("sha256")
    .update(address.toLowerCase())
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
}

/** The sensitive subset we encrypt before persisting. */
interface EncryptedSecret {
  delegatedShare: unknown;
  walletApiKey: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use the delegation store"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function getEncryptionKey(): Buffer {
  const hex = process.env.DELEGATION_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "DELEGATION_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). " +
        "Generate one with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

const TABLE = "delegations";

// ─── AES-256-GCM encryption at rest ─────────────────────────────────────────────

function encryptSecret(secret: EncryptedSecret): {
  ciphertext: string;
  iv: string;
  tag: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce, unique per write
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(secret), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptSecret(row: {
  secret_ciphertext: string;
  secret_iv: string;
  secret_tag: string;
}): EncryptedSecret {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(row.secret_iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(row.secret_tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(row.secret_ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as EncryptedSecret;
}

// ─── Store / read / delete ──────────────────────────────────────────────────────

/** Upsert a delegation, encrypting the share + API key before persisting. */
export async function storeDelegation(record: DelegationRecord): Promise<void> {
  const supabase = getSupabase();
  const { ciphertext, iv, tag } = encryptSecret({
    delegatedShare: record.delegatedShare,
    walletApiKey: record.walletApiKey,
  });

  const code = deriveAccountCode(record.address);
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: record.userId,
      chain: record.chain,
      wallet_id: record.walletId,
      address: record.address.toLowerCase(),
      code,
      secret_ciphertext: ciphertext,
      secret_iv: iv,
      secret_tag: tag,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,chain" }
  );

  if (error) throw new Error(`Failed to store delegation: ${error.message}`);
  console.log(
    `✅ Stored encrypted delegation for ${record.address} (${record.chain}) — account code ${code}`
  );
}

function rowToRecord(row: Record<string, unknown>): DelegationRecord {
  const secret = decryptSecret(
    row as { secret_ciphertext: string; secret_iv: string; secret_tag: string }
  );
  return {
    userId: row.user_id as string,
    chain: row.chain as string,
    walletId: row.wallet_id as string,
    address: row.address as string,
    code: (row.code as string) ?? deriveAccountCode(row.address as string),
    delegatedShare: secret.delegatedShare,
    walletApiKey: secret.walletApiKey,
  };
}

/** Resolve a delegation by its short account code (how the agent picks a user's wallet). */
export async function getDelegationByCode(
  code: string,
  chain: string = DELEGATION_CHAIN
): Promise<DelegationRecord | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("chain", chain)
    .maybeSingle();
  if (error) throw new Error(`Failed to read delegation: ${error.message}`);
  return data ? rowToRecord(data) : undefined;
}

export async function getDelegation(
  userId: string,
  chain: string
): Promise<DelegationRecord | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("chain", chain)
    .maybeSingle();
  if (error) throw new Error(`Failed to read delegation: ${error.message}`);
  return data ? rowToRecord(data) : undefined;
}

export async function getDelegationByAddress(
  address: string,
  chain: string
): Promise<DelegationRecord | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("address", address.toLowerCase())
    .eq("chain", chain)
    .maybeSingle();
  if (error) throw new Error(`Failed to read delegation: ${error.message}`);
  return data ? rowToRecord(data) : undefined;
}

/** Convenience for the agent: the most recently delegated EVM wallet. */
export async function getLatestDelegation(
  chain: string = DELEGATION_CHAIN
): Promise<DelegationRecord | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("chain", chain)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to read delegation: ${error.message}`);
  return data ? rowToRecord(data) : undefined;
}

export async function deleteDelegation(
  userId: string,
  chain: string
): Promise<boolean> {
  const supabase = getSupabase();
  const { error, count } = await supabase
    .from(TABLE)
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("chain", chain);
  if (error) throw new Error(`Failed to delete delegation: ${error.message}`);
  return (count ?? 0) > 0;
}
