import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/dynamic/dynamic-auth";
import { FREQUENCY_KEYS } from "@/lib/schedule";
import { getStore } from "@/lib/store";

const PatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    frequency: z.enum(FREQUENCY_KEYS).optional(),
  })
  .refine((b) => b.enabled !== undefined || b.frequency !== undefined, {
    message: "nothing to update",
  });

/** PATCH /api/rules/:id — pause/resume a rule or change how often it runs. */
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
    const updated = {
      ...rule,
      ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
      ...(parsed.data.frequency && { frequency: parsed.data.frequency }),
    };
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
