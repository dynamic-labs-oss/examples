import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/dynamic/webhooks/verify-signature";
import { DynamicWebhookEventSchema } from "@/lib/dynamic/webhooks/schemas";
import { decryptMaterials } from "@/lib/dynamic/delegation/decrypt";
import { encryptSecret } from "@/lib/crypto";
import { getStore } from "@/lib/store";

/**
 * POST /api/webhooks/dynamic — receives wallet.delegation.created/revoked
 * from Dynamic. Created: decrypts the delivered share + wallet API key and
 * stores them AES-256-GCM encrypted. Revoked: drops the grant and disables
 * the wallet's rules so no further sweeps can sign.
 */
export const POST = async (req: NextRequest) => {
  const verified = await verifyWebhookSignature(req);
  if (!verified.success) {
    return NextResponse.json(
      { error: verified.error },
      { status: verified.status }
    );
  }
  const parsed = DynamicWebhookEventSchema.safeParse(verified.payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "unknown event" }, { status: 400 });
  }
  const event = parsed.data;
  const store = getStore();

  if (event.eventName === "ping") {
    return NextResponse.json({ ok: true });
  }

  if (event.eventName === "wallet.delegation.created") {
    const { data } = event;
    const { delegatedShare, delegatedKey } = decryptMaterials(
      data.encryptedDelegatedShare,
      data.encryptedWalletApiKey
    );
    await store.putDelegation({
      userId: data.userId,
      chain: data.chain,
      walletId: data.walletId,
      address: data.publicKey,
      shareSetId: data.shareSetId,
      delegatedShareEnc: encryptSecret(JSON.stringify(delegatedShare)),
      walletApiKeyEnc: encryptSecret(delegatedKey),
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }

  // wallet.delegation.revoked
  const { data } = event;
  await store.deleteDelegation(data.userId, data.chain);
  const rules = await store.listRules();
  for (const rule of rules.filter(
    (r) => r.walletAddress.toLowerCase() === data.publicKey.toLowerCase() && r.enabled
  )) {
    await store.putRule({ ...rule, enabled: false });
  }
  return NextResponse.json({ ok: true });
};
