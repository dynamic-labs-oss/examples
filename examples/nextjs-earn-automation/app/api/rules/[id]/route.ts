import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/dynamic/dynamic-auth";
import { getStore } from "@/lib/store";

const PatchSchema = z.object({ enabled: z.boolean() });

/** PATCH /api/rules/:id — pause or resume a rule. */
export const PATCH = withAuth(
  async (
    req: NextRequest,
    { user }
  ): Promise<NextResponse> => {
    const id = new URL(req.url).pathname.split("/").pop() as string;
    const rule = await getStore().getRule(id);
    if (!rule || rule.userId !== user.sub) {
      return NextResponse.json({ error: "rule not found" }, { status: 404 });
    }
    const parsed = PatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const updated = { ...rule, enabled: parsed.data.enabled };
    await getStore().putRule(updated);
    return NextResponse.json({ rule: updated });
  }
);

/** DELETE /api/rules/:id — remove the rule (delegation revoke is separate). */
export const DELETE = withAuth(
  async (req, { user }): Promise<NextResponse> => {
    const id = new URL(req.url).pathname.split("/").pop() as string;
    const rule = await getStore().getRule(id);
    if (!rule || rule.userId !== user.sub) {
      return NextResponse.json({ error: "rule not found" }, { status: 404 });
    }
    await getStore().deleteRule(id);
    return NextResponse.json({ ok: true });
  }
);
