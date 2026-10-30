import "server-only";
import crypto from "crypto";
import { env } from "@/env";

/**
 * AES-256-GCM at-rest encryption for stored delegation material (the
 * decrypted delegated share + wallet API key). The Dynamic webhook delivers
 * them encrypted in transit; this layer keeps them encrypted in our DB too,
 * so a database dump alone doesn't hand over signing capability.
 */
const key = crypto.createHash("sha256").update(env.ENCRYPTION_KEY).digest();

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, ctB64] = payload.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
