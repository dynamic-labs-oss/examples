import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { userOwnsAddress, withAuth } from "@/lib/dynamic/dynamic-auth";
import { encryptSecret } from "@/lib/crypto";
import { getStore } from "@/lib/store";

/** GET /api/delegations — which of the caller's wallets have delegation grants. */
export const GET = withAuth(async (_req, { user }) => {
  const owned = new Set(
    user.verified_credentials.map((c) => c.address.toLowerCase())
  );
  const delegations = (await Promise.all(
    [...owned].map((a) => getStore().getDelegation(a))
  )).filter(Boolean);
  return NextResponse.json({
    delegations: delegations.map((d) => ({
      address: d!.address,
      chain: d!.chain,
      walletId: d!.walletId,
      createdAt: d!.createdAt,
    })),
  });
});

const ManualSchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  walletId: z.string().min(1),
  walletApiKey: z.string().min(1),
  delegatedShare: z.unknown(),
  shareSetId: z.string().optional(),
});

/**
 * POST /api/delegations — local-dev fallback for seeding a delegation grant
 * when the Dynamic webhook can't reach localhost (no tunnel). Equivalent to
 * what the wallet.delegation.created webhook does, minus the transport
 * encryption — the share arrives already decrypted from the client and is
 * still stored AES-256-GCM encrypted.
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const parsed = ManualSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const body = parsed.data;
  if (!userOwnsAddress(user, body.walletAddress)) {
    return NextResponse.json({ error: "wallet not owned" }, { status: 403 });
  }
  await getStore().putDelegation({
    userId: user.sub,
    chain: "eip155",
    walletId: body.walletId,
    address: body.walletAddress,
    shareSetId: body.shareSetId,
    delegatedShareEnc: encryptSecret(JSON.stringify(body.delegatedShare)),
    walletApiKeyEnc: encryptSecret(body.walletApiKey),
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
});
