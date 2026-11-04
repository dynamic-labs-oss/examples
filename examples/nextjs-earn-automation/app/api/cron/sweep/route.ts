import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isCronAuthorized } from "@/lib/cron-auth";
import { executeRule } from "@/lib/earn";
import { isDue } from "@/lib/schedule";
import { getStore, type AutomationRule } from "@/lib/store";

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
 * The automation executor. Call it on a fixed tick (vercel.json runs it
 * hourly); each rule only runs once its own `frequency` has elapsed.
 * Pass {"ruleId": "..."} to force a single rule regardless of its schedule.
 */
async function handle(req: NextRequest, ruleId?: string) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const store = getStore();
  const now = Date.now();
  let rules: AutomationRule[];
  let notDue = 0;
  if (ruleId) {
    rules = [await store.getRule(ruleId)].filter(
      (r): r is AutomationRule => !!r
    );
  } else {
    const enabled = (await store.listRules()).filter((r) => r.enabled);
    rules = enabled.filter((r) => isDue(r, now));
    notDue = enabled.length - rules.length;
  }
  return NextResponse.json({ results: await runSweep(rules), notDue });
}

/** POST /api/cron/sweep — `Authorization: Bearer $CRON_SECRET`. */
export const POST = async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as { ruleId?: string };
  return handle(req, body.ruleId);
};

/** GET /api/cron/sweep — Vercel Cron issues GET and sends the same bearer. */
export const GET = (req: NextRequest) => handle(req);
