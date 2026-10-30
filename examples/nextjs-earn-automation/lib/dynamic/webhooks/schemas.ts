import { z } from "zod";

export const EncryptedDelegatedShareSchema = z.object({
  alg: z.string(),
  iv: z.string(),
  ct: z.string(),
  tag: z.string(),
  ek: z.string(),
  kid: z.string().optional(),
});
export type EncryptedDelegatedShare = z.infer<
  typeof EncryptedDelegatedShareSchema
>;

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

export const PingEventSchema = BaseWebhookSchema.extend({
  eventName: z.literal("ping"),
  data: z.object({ webhookId: z.string() }).passthrough(),
});
export type PingEvent = z.infer<typeof PingEventSchema>;

export const DelegationCreatedEventSchema = BaseWebhookSchema.extend({
  eventName: z.literal("wallet.delegation.created"),
  data: z.object({
    encryptedDelegatedShare: EncryptedDelegatedShareSchema,
    walletId: z.string(),
    shareSetId: z.string().optional(),
    chain: z.string(),
    publicKey: z.string(),
    userId: z.string(),
    encryptedWalletApiKey: EncryptedDelegatedShareSchema,
  }),
});
export type DelegationCreatedEvent = z.infer<
  typeof DelegationCreatedEventSchema
>;

export const DelegationRevokedEventSchema = BaseWebhookSchema.extend({
  eventName: z.literal("wallet.delegation.revoked"),
  data: z.object({
    walletId: z.string(),
    chain: z.string(),
    publicKey: z.string(),
    userId: z.string(),
  }),
});
export type DelegationRevokedEvent = z.infer<
  typeof DelegationRevokedEventSchema
>;

export const DynamicWebhookEventSchema = z.discriminatedUnion("eventName", [
  PingEventSchema,
  DelegationCreatedEventSchema,
  DelegationRevokedEventSchema,
]);
