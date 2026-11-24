import { NextRequest, NextResponse } from "next/server";
import { collectDue } from "@/lib/collect";

// Collects EVERY due authorization (all subscribers). Called by the Vercel
// Schedule in vercel.json. When CRON_SECRET is set it requires
// `Authorization: Bearer <CRON_SECRET>`, so it can't be called from the
// browser — the "Collect due pulls" button uses /api/collect instead, which
// is scoped to the connected wallet.
// Each pull waits for a receipt; allow several in one run.
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
    return NextResponse.json(await collectDue());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Collect failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
