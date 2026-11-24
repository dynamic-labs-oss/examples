import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { collectSolanaDue } from "@/lib/solana/collector";

// POST /api/solana/collect?subscriber=<base58> — what the "Collect due pulls"
// button calls for Solana.
//
// No secret is needed because it can only do what the schedule would do
// anyway, for one wallet: pull amounts that are ALREADY due. The Subscriptions
// program enforces the per-period cap on-chain and funds only ever go to the
// plan's destination, so the worst a caller can do is make the merchant key pay
// a few fees a little sooner. Capped at 5 pulls per call.
export const maxDuration = 60;

const Query = z.object({
  subscriber: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "invalid address"),
});

export async function POST(req: NextRequest) {
  const parsed = Query.safeParse({ subscriber: req.nextUrl.searchParams.get("subscriber") });
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid subscriber address is required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await collectSolanaDue({ subscriber: parsed.data.subscriber, limit: 5 }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Collect failed" }, { status: 500 });
  }
}
