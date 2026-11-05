/**
 * One-off importer: takes a `wallet.delegation.created` webhook payload (e.g.
 * relayed from webhook.site), decrypts the delegated share + wallet API key with
 * the RSA private key, and stores them (AES-256-GCM encrypted) in Supabase — the
 * same thing the live webhook handler does, but driven by a payload you paste in.
 *
 * Usage:  pnpm tsx agent/import-delegation.ts <path-to-payload.json>
 *
 * The payload must contain data.encryptedDelegatedShare + data.encryptedWalletApiKey
 * (each { ek, iv, ct, tag }), walletId, chain, publicKey, userId.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import crypto from "crypto";
import { storeDelegation } from "../lib/shared/delegation-store";

interface Enc {
  ek: string;
  iv: string;
  ct: string;
  tag: string;
}

function rsaOaepDecryptEk(privateKeyPem: string, ekB64: string): Buffer {
  return crypto.privateDecrypt(
    {
      key: privateKeyPem,
      oaepHash: "sha256",
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(ekB64, "base64url")
  );
}

function aesGcmDecrypt(key: Buffer, e: Enc): Buffer {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(e.iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(e.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(e.ct, "base64url")),
    decipher.final(),
  ]);
}

function decrypt(e: Enc, pem: string): Buffer {
  return aesGcmDecrypt(rsaOaepDecryptEk(pem, e.ek), e);
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: tsx agent/import-delegation.ts <payload.json>");

  const payload = JSON.parse(readFileSync(path, "utf8"));
  const data = payload.data ?? payload; // accept the full webhook body or just `data`

  const pem = (process.env.DYNAMIC_DELEGATION_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!pem) throw new Error("DYNAMIC_DELEGATION_PRIVATE_KEY not set");

  const delegatedShare = JSON.parse(
    decrypt(data.encryptedDelegatedShare as Enc, pem).toString("utf8")
  );
  const walletApiKey = decrypt(data.encryptedWalletApiKey as Enc, pem).toString("utf8");

  await storeDelegation({
    userId: data.userId,
    chain: data.chain, // typically "EVM"
    walletId: data.walletId,
    address: data.publicKey,
    delegatedShare,
    walletApiKey,
  });

  console.log(`✅ Imported + stored delegation for ${data.publicKey} (${data.chain})`);
  console.log("   Run `pnpm agent` to spend from it.");
}

main().catch((err) => {
  console.error("❌ Import failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
