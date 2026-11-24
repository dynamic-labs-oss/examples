import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { collectDue } from "@/lib/collect";

// POST /api/collect?subscriber=0x… — what the "Collect due pulls" button calls.
//
// No secret is needed because this can only do what the schedule would do
// anyway, for one wallet: execute pulls that are ALREADY due. Nothing can be
// pulled early (the plan contract enforces the cadence on-chain) and funds
// only ever go to the merchant. Worst case a caller makes the relayer pay gas
// a little sooner than the next scheduled run, so it is capped to a few pulls
// per call.
export const maxDuration = 60;

const Query = z.object({ subscriber: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "invalid address") });

export async function POST(req: NextRequest) {
  const parsed = Query.safeParse({ subscriber: req.nextUrl.searchParams.get("subscriber") });
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid subscriber address is required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await collectDue({ subscriber: parsed.data.subscriber, limit: 5 }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Collect failed" }, { status: 500 });
  }
}
