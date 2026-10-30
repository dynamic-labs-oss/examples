import "server-only";
import crypto from "crypto";
import { env } from "@/env";
import type { EncryptedDelegatedShare } from "@/lib/dynamic/webhooks/schemas";

function getPrivateKey(): string {
  const pem = env.DYNAMIC_DELEGATION_PRIVATE_KEY;
  if (!pem) {
    throw new Error(
      "DYNAMIC_DELEGATION_PRIVATE_KEY not set — add your RSA private key to .env.local"
    );
  }
  return pem.replace(/\\n/g, "\n");
}

function decryptAesGcm(
  symmetricKey: Buffer,
  ivB64: string,
  ctB64: string,
  tagB64: string
) {
  const iv = Buffer.from(ivB64, "base64url");
  const ciphertext = Buffer.from(ctB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", symmetricKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function rsaOaepDecryptEk(privateKeyPem: string, ekB64: string) {
  return crypto.privateDecrypt(
    {
      key: privateKeyPem,
      oaepHash: "sha256",
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(ekB64, "base64url")
  );
}

/**
 * Decrypts the delegated share + wallet API key delivered by the
 * wallet.delegation.created webhook (RSA-OAEP wrapped AES-256-GCM).
 */
export function decryptMaterials(
  share: EncryptedDelegatedShare,
  apiKeyEnc: EncryptedDelegatedShare
): { delegatedShare: unknown; walletApiKey: string } {
  const privateKeyPem = getPrivateKey();
  const shareKey = rsaOaepDecryptEk(privateKeyPem, share.ek);
  const walletApiKeyKey = rsaOaepDecryptEk(privateKeyPem, apiKeyEnc.ek);

  const delegatedShare = decryptAesGcm(shareKey, share.iv, share.ct, share.tag);
  const walletApiKey = decryptAesGcm(
    walletApiKeyKey,
    apiKeyEnc.iv,
    apiKeyEnc.ct,
    apiKeyEnc.tag
  );

  return {
    delegatedShare: JSON.parse(delegatedShare.toString("utf8")),
    walletApiKey: walletApiKey.toString("utf8"),
  };
}
