import { NextRequest, NextResponse } from "next/server";
import { collectSolanaDue } from "@/lib/solana/collector";

// Collects EVERY due Solana pull (all subscribers). Called by the hourly
// Vercel Schedule in vercel.json. When CRON_SECRET is set it requires
// `Authorization: Bearer <CRON_SECRET>`; the button uses the wallet-scoped,
// secret-free /api/solana/collect instead.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    return NextResponse.json(await collectSolanaDue());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Collect failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
