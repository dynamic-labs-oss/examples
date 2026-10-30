import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { env } from "@/env";
import { executeRule } from "@/lib/earn";
import { getStore, type AutomationRule } from "@/lib/store";

function authorized(req: NextRequest): boolean {
  return req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

async function runSweep(rules: AutomationRule[]) {
  const store = getStore();
  const results = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const run = {
      id: randomUUID(),
      ruleId: rule.id,
      createdAt: new Date().toISOString(),
    } as Parameters<typeof store.addRun>[0];
    try {
      const result = await executeRule(rule);
      Object.assign(run, {
        status: result.status,
        amount: result.amount,
        txHash: result.txHash,
        reason: result.reason,
      });
    } catch (error) {
      Object.assign(run, {
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    await store.addRun(run);
    await store.putRule({ ...rule, lastRunAt: run.createdAt });
    results.push({ ...run });
  }
  return results;
}

/**
 * POST /api/cron/sweep — the automation executor. Point a cron (Vercel Cron,
 * system cron, or a manual `curl`) at it with `Authorization: Bearer
 * $CRON_SECRET`. Pass {"ruleId": "..."} to run a single rule.
 */
export const POST = async (req: NextRequest) => {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const store = getStore();
  const body = (await req.json().catch(() => ({}))) as { ruleId?: string };
  const rules = body.ruleId
    ? [await store.getRule(body.ruleId)].filter((r): r is AutomationRule => !!r)
    : await store.listRules();
  return NextResponse.json({ results: await runSweep(rules) });
};
