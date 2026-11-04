import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withAuth } from "@/lib/dynamic/dynamic-auth";
import { executeRule } from "@/lib/earn";
import { getStore } from "@/lib/store";

/** POST /api/rules/:id/run — execute one of the caller's rules right now. */
export const POST = withAuth(async (req, { user }): Promise<NextResponse> => {
  const id = new URL(req.url).pathname.split("/").at(-2) as string;
  const rule = await getStore().getRule(id);
  if (!rule || rule.userId !== user.sub) {
    return NextResponse.json({ error: "rule not found" }, { status: 404 });
  }
  const store = getStore();
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
  return NextResponse.json({ run });
});
