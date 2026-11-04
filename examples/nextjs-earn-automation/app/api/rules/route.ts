import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { withAuth } from "@/lib/dynamic/dynamic-auth";
import { DEFAULT_FREQUENCY, FREQUENCY_KEYS } from "@/lib/schedule";
import { getStore } from "@/lib/store";
import { env } from "@/env";

const CreateRuleSchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  vaultId: z.string().min(1),
  mode: z.enum(["sweep", "fixed"]),
  amount: z.string().optional(),
  sponsored: z.boolean().default(true),
  gasReserve: z.string().default("0.005"),
  frequency: z.enum(FREQUENCY_KEYS).default(DEFAULT_FREQUENCY),
});

/** GET /api/rules — the caller's automation rules, newest last. */
export const GET = withAuth(async (_req, { user }) => {
  const rules = await getStore().listRules(user.sub);
  const runs = await getStore().listRuns(rules.map((r) => r.id));
  // listRuns is newest-first, so keep the first run seen for each rule.
  const latestRun = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latestRun.has(run.ruleId)) latestRun.set(run.ruleId, run);
  }
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

  const delegation = await store.getDelegation(body.walletAddress);
  if (!delegation) {
    return NextResponse.json(
      { error: "wallet is not delegated — complete delegation first" },
      { status: 409 }
    );
  }
  // The grant's userId comes from Dynamic's signed webhook, so it is the
  // authoritative owner (the JWT can predate a freshly created wallet).
  if (delegation.userId !== user.sub) {
    return NextResponse.json(
      { error: "wallet does not belong to this user" },
      { status: 403 }
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
    frequency: body.frequency,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  await store.putRule(rule);
  return NextResponse.json({ rule }, { status: 201 });
});
