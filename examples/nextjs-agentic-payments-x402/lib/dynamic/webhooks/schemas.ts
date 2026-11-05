import { z } from "zod";

/**
 * Schema for encrypted data using RSA-OAEP + AES-GCM hybrid encryption
 *
 * This schema represents the encrypted format used for both:
 * - Delegated share (ECDSA keygen result)
 * - Wallet API key
 *
 * Field descriptions:
 * - alg: Encryption algorithm identifier
 * - ek: Encrypted symmetric key (RSA-OAEP encrypted AES-256 key, base64url encoded)
 * - iv: Initialization vector for AES-GCM (base64url encoded)
 * - ct: Ciphertext (encrypted data, base64url encoded)
 * - tag: Authentication tag for AES-GCM (base64url encoded)
 * - kid: Key ID (optional, used to identify which public key was used for encryption)
 */
export const EncryptedDelegatedShareSchema = z.object({
  alg: z.string(),
  iv: z.string(),
  ct: z.string(),
  tag: z.string(),
  ek: z.string(),
  kid: z.string().optional(), // Optional because not all encrypted objects have it
});

/**
 * Base schema containing common fields present in all Dynamic webhook events
 *
 * These fields are included in every webhook payload from Dynamic:
 * - messageId: Unique identifier for this webhook message
 * - eventId: Unique identifier for the event that triggered this webhook
 * - timestamp: ISO 8601 timestamp when the event occurred
 * - webhookId: Identifier for the webhook configuration
 * - environmentId: Dynamic environment ID
 * - environmentName: Human-readable environment name (optional)
 * - userId: User ID associated with the event (nullable for system events)
 * - redelivery: Whether this is a redelivery of a previously sent webhook (optional)
 */
const BaseWebhookSchema = z.object({
  messageId: z.string(),
  eventId: z.string(),
  timestamp: z.string(),
  webhookId: z.string(),
  environmentId: z.string(),
  environmentName: z.string().optional(),
  userId: z.string().nullable(),
  redelivery: z.boolean().optional(),
});

/**
 * Schema for ping webhook event
 *
 * This event is sent by Dynamic to verify that your webhook endpoint is working correctly.
 * It's typically triggered when you configure or test a webhook in the Dynamic dashboard.
 *
 * The data object includes:
 * - webhookId: The webhook configuration ID
 * - message: A test message from Dynamic
 * - events: Array of event types this webhook is configured to receive
 * - url: The webhook URL configured in Dynamic
 * - isEnabled: Whether the webhook is currently enabled
 */
export const PingEventSchema = BaseWebhookSchema.extend({
  eventName: z.literal("ping"),
  data: z.object({
    webhookId: z.string(),
    message: z.string(),
    events: z.array(z.string()),
    url: z.string(),
    isEnabled: z.boolean(),
  }),
});

/**
 * Schema for wallet.delegation.created webhook event
 *
 * This event is fired when a user creates a delegated wallet through Dynamic's UI.
 * It contains the encrypted delegation share and wallet API key that need to be
 * decrypted using your RSA private key.
 *
 * The data object includes:
 * - encryptedDelegatedShare: Encrypted ECDSA keygen share (decrypt to get the share)
 * - encryptedWalletApiKey: Encrypted wallet API key (decrypt to authenticate API calls)
 * - walletId: Unique identifier for the delegated wallet
 * - chain: Chain identifier (e.g., "eip155:1" for Ethereum mainnet)
 * - publicKey: The public key/address of the delegated wallet
 * - userId: The user who created the delegation
 */
export const DelegationCreatedEventSchema = BaseWebhookSchema.extend({
  eventName: z.literal("wallet.delegation.created"),
  data: z.object({
    encryptedDelegatedShare: EncryptedDelegatedShareSchema,
    walletId: z.string(),
    chain: z.string(),
    publicKey: z.string(),
    userId: z.string(),
    encryptedWalletApiKey: EncryptedDelegatedShareSchema,
  }),
});

/**
 * Schema for wallet.delegation.revoked webhook event
 *
 * This event is fired when a user revokes a delegated wallet through Dynamic's UI.
 * When received, you should remove the stored delegation share from your storage
 * to ensure the server can no longer perform operations on behalf of the user.
 *
 * The data object includes:
 * - walletId: Unique identifier for the delegated wallet
 * - chain: Chain identifier (e.g., "EVM")
 * - publicKey: The public key/address of the delegated wallet
 * - userId: The user who revoked the delegation
 */
export const DelegationRevokedEventSchema = BaseWebhookSchema.extend({
  eventName: z.literal("wallet.delegation.revoked"),
  data: z.object({
    walletId: z.string(),
    chain: z.string(),
    publicKey: z.string(),
    userId: z.string(),
  }),
});

/**
 * Discriminated union schema for all webhook event types
 *
 * This schema uses Zod's discriminatedUnion to create a type-safe union of all
 * possible webhook events. The "eventName" field acts as the discriminator,
 * allowing TypeScript to narrow the type based on the event name.
 *
 * Benefits:
 * - Type-safe event handling (TypeScript knows which fields are available)
 * - Runtime validation ensures payloads match expected structure
 * - Exhaustive checking in switch statements (TypeScript errors if you miss an event)
 *
 * To add a new event type:
 * 1. Create a new schema extending BaseWebhookSchema
 * 2. Add it to this discriminated union
 * 3. TypeScript will require you to handle it in switch statements
 */
export const WebhookPayloadSchema = z.discriminatedUnion("eventName", [
  DelegationCreatedEventSchema,
  DelegationRevokedEventSchema,
  PingEventSchema,
]);

/**
 * TypeScript types inferred from Zod schemas
 *
 * These types are automatically generated from the schemas above, ensuring
 * type safety between runtime validation and compile-time type checking.
 */
export type EncryptedDelegatedShare = z.infer<
  typeof EncryptedDelegatedShareSchema
>;
export type DelegationCreatedEvent = z.infer<
  typeof DelegationCreatedEventSchema
>;
export type DelegationRevokedEvent = z.infer<
  typeof DelegationRevokedEventSchema
>;
export type PingEvent = z.infer<typeof PingEventSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
