import * as crypto from "crypto";
import type { ServerKeyShare } from "@dynamic-labs-wallet/node";
import type { EncryptedDelegatedShare } from "@/lib/dynamic/webhooks/schemas";
import { env } from "@/env";

/**
 * Gets the formatted private key from environment variables
 */
function getPrivateKey(): string {
  const privateKeyPem = env.DYNAMIC_DELEGATION_PRIVATE_KEY;

  if (!privateKeyPem) {
    throw new Error(
      "DYNAMIC_DELEGATION_PRIVATE_KEY not found in environment variables. " +
        "Add your RSA private key to .env.local - see README for setup."
    );
  }

  // Format the private key (handles both inline \n and actual newlines)
  return privateKeyPem.replace(/\\n/g, "\n");
}

/**
 * Decrypts AES-GCM encrypted data
 */
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

/**
 * Decrypts the encrypted key (ek) using RSA-OAEP
 */
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
 * Decrypts both the delegated share and wallet API key using RSA-OAEP + AES-GCM hybrid encryption
 *
 * How Dynamic's encryption works:
 * 1. A random symmetric key (AES-256) is generated
 * 2. The symmetric key is encrypted with your RSA public key -> `ek` field
 * 3. The actual share data is encrypted with the symmetric key (AES-GCM) -> `ct` field
 * 4. Initialization vector (`iv`) and authentication tag (`tag`) are included for GCM mode
 *
 * Decryption process:
 * 1. Decrypt the symmetric key using your RSA private key (loaded from DYNAMIC_DELEGATION_PRIVATE_KEY env var)
 * 2. Use the symmetric key to decrypt the actual data with AES-GCM
 *
 * @param share - The encrypted delegated share from Dynamic webhook
 * @param apiKeyEnc - The encrypted wallet API key from Dynamic webhook
 * @returns An object containing:
 *   - delegatedShare: The decrypted share as EcdsaKeygenResult
 *   - walletApiKey: The decrypted wallet API key as a string
 * @throws Error if DYNAMIC_DELEGATION_PRIVATE_KEY is not set or if decryption fails
 */
export function decryptMaterials(
  share: EncryptedDelegatedShare,
  apiKeyEnc: EncryptedDelegatedShare
): { delegatedShare: ServerKeyShare; walletApiKey: string } {
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
