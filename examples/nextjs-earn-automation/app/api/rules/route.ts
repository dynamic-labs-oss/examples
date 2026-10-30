import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  userOwnsAddress,
  withAuth,
} from "@/lib/dynamic/dynamic-auth";
import { getStore } from "@/lib/store";
import { env } from "@/env";

const CreateRuleSchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  vaultId: z.string().min(1),
  mode: z.enum(["sweep", "fixed"]),
  amount: z.string().optional(),
  sponsored: z.boolean().default(true),
  gasReserve: z.string().default("0.005"),
});

/** GET /api/rules — the caller's automation rules, newest last. */
export const GET = withAuth(async (_req, { user }) => {
  const rules = await getStore().listRules(user.sub);
  const runs = await getStore().listRuns(rules.map((r) => r.id));
  const latestRun = new Map(runs.map((r) => [r.ruleId, r]));
  return NextResponse.json({
    rules: rules.map((r) => ({ ...r, lastRun: latestRun.get(r.id) ?? null })),
  });
});

/** POST /api/rules — opt a delegated wallet into a vault automation. */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const parsed = CreateRuleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const body = parsed.data;
  const store = getStore();

  if (!userOwnsAddress(user, body.walletAddress)) {
    return NextResponse.json(
      { error: "wallet does not belong to this user" },
      { status: 403 }
    );
  }

  const delegation = await store.getDelegation(body.walletAddress);
  if (!delegation) {
    return NextResponse.json(
      { error: "wallet is not delegated — complete delegation first" },
      { status: 409 }
    );
  }
  if (body.mode === "fixed" && !body.amount) {
    return NextResponse.json(
      { error: "amount is required for fixed mode" },
      { status: 400 }
    );
  }

  // Resolve the vault server-side so the stored rule pins the real asset/chain.
  const res = await fetch(
    `${env.NEXT_PUBLIC_DYNAMIC_API_BASE}/sdk/${env.NEXT_PUBLIC_DYNAMIC_ENV_ID}/yield/vaults/${body.vaultId}`,
    { headers: { Authorization: `Bearer ${env.DYNAMIC_API_TOKEN}` } }
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: `vault lookup failed (${res.status})` },
      { status: 502 }
    );
  }
  const vault = (await res.json()) as {
    vaultId: string;
    chainId: number;
    assetAddress: string;
    assetSymbol: string;
    assetDecimals: number;
    name?: string;
  };

  const rule = {
    id: randomUUID(),
    userId: user.sub,
    walletAddress: body.walletAddress,
    walletId: delegation.walletId,
    vaultId: vault.vaultId,
    chainId: Number(vault.chainId),
    assetAddress: vault.assetAddress,
    assetSymbol: vault.assetSymbol,
    assetDecimals: vault.assetDecimals,
    mode: body.mode,
    amount: body.mode === "fixed" ? body.amount : undefined,
    sponsored: body.sponsored,
    gasReserve: body.gasReserve,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  await store.putRule(rule);
  return NextResponse.json({ rule }, { status: 201 });
});
