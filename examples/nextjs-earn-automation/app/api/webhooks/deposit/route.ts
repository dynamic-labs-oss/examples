import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { env } from "@/env";
import { executeRule } from "@/lib/earn";
import { getStore, type AutomationRule } from "@/lib/store";

/**
 * POST /api/webhooks/deposit — webhook-triggered sweep. Wire a
 * balance-change notification (e.g. Alchemy Notify / an indexer) to this
 * endpoint; every enabled rule on the reported wallet address is executed.
 * Guarded by the same CRON_SECRET bearer as the cron route.
 *
 * Body: { "address": "0x...", "assetAddress"?: "0x..." }
 */
export const POST = async (req: NextRequest) => {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { address, assetAddress } = (await req.json().catch(() => ({}))) as {
    address?: string;
    assetAddress?: string;
  };
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const store = getStore();
  const rules = (await store.listRules()).filter(
    (r) =>
      r.enabled &&
      r.walletAddress.toLowerCase() === address.toLowerCase() &&
      (!assetAddress ||
        r.assetAddress.toLowerCase() === assetAddress.toLowerCase())
  );

  const results = [];
  for (const rule of rules) {
    const run = {
      id: randomUUID(),
      ruleId: rule.id,
      createdAt: new Date().toISOString(),
    } as Parameters<typeof store.addRun>[0];
    try {
      Object.assign(run, await executeRule(rule));
    } catch (error) {
      Object.assign(run, {
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    await store.addRun(run);
    await store.putRule({ ...rule, lastRunAt: run.createdAt });
    results.push(run);
  }
  return NextResponse.json({ matched: rules.length, results });
};
