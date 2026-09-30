import {
  decryptMaterials,
  deleteDelegation,
  storeDelegation,
} from "@/lib/dynamic/delegation";
import type {
  DelegationCreatedEvent,
  DelegationRevokedEvent,
  PingEvent,
} from "@/lib/dynamic/webhooks/schemas";

/**
 * Handle ping webhook event from Dynamic
 *
 * This is used to verify that the webhook endpoint is working correctly.
 * Dynamic sends this event when you configure or test a webhook in the dashboard.
 */
export async function handlePing(_payload: PingEvent) {
  return { success: true, message: "Pong" };
}

/**
 * Handle wallet.delegation.created webhook event
 *
 * This is triggered when a user creates a delegated wallet through Dynamic's UI.
 *
 * Process:
 * 1. Decrypts the delegated share and wallet API key using RSA-OAEP + AES-GCM hybrid encryption
 * 2. Re-encrypts (AES-256-GCM) and stores the materials in Supabase
 * 3. Enables server-side delegated operations (signing transactions, etc.)
 *
 * The decrypted share and API key are stored securely and can be retrieved later
 * to perform delegated wallet operations on behalf of the user.
 */
export async function handleDelegationCreated(payload: DelegationCreatedEvent) {
  try {
    console.log("🔐 Decrypting delegation data...");

    // Decrypt the delegated share and wallet API key using hybrid encryption
    // (RSA-OAEP for key exchange, AES-256-GCM for data encryption)
    const { delegatedShare, walletApiKey } = decryptMaterials(
      payload.data.encryptedDelegatedShare,
      payload.data.encryptedWalletApiKey
    );

    // Encrypt-at-rest and store the delegation in Supabase.
    // This enables server-side delegated operations like signing transactions
    await storeDelegation({
      userId: payload.data.userId,
      chain: payload.data.chain,
      walletId: payload.data.walletId,
      address: payload.data.publicKey,
      delegatedShare,
      walletApiKey,
    });

    console.log("✅ Successfully processed delegation");
    return { success: true, message: "Delegation created" };
  } catch (error) {
    // Log details server-side; return a generic message (avoid leaking crypto/
    // internal errors in the response, even though this route is signature-gated).
    console.error("❌ Failed to process delegation:", error);
    return { success: false, message: "Failed to process delegation" };
  }
}

/**
 * Handle wallet.delegation.revoked webhook event
 *
 * This is triggered when a user revokes a delegated wallet through Dynamic's UI.
 *
 * Process:
 * 1. Removes the delegation record from Supabase
 * 2. Prevents any further server-side operations with the revoked delegation
 *
 * After this handler completes, the server will no longer be able to perform
 * delegated operations for this wallet until a new delegation is created.
 */
export async function handleDelegationRevoked(payload: DelegationRevokedEvent) {
  try {
    console.log(
      `🔓 Revoking delegation for user ${payload.data.userId} on ${payload.data.chain}...`
    );

    // Remove the delegation from storage
    const deleted = await deleteDelegation(
      payload.data.userId,
      payload.data.chain
    );

    if (deleted) {
      console.log("✅ Successfully revoked delegation");
      return { success: true, message: "Delegation revoked" };
    } else {
      console.log("⚠️ No delegation found to revoke");
      return { success: true, message: "No delegation found to revoke" };
    }
  } catch (error) {
    console.error("❌ Failed to revoke delegation:", error);
    return { success: false, message: "Failed to revoke delegation" };
  }
}
