import { NextRequest, NextResponse } from "next/server";
import { supabase, type AuthorizationRow } from "@/lib/supabase";
import { executeAuthorization } from "@/lib/collector";

// Collects every due authorization: pending, inside its validity window, on
// an active subscription. Called by Vercel cron (see vercel.json) and by the
// "Collect due pulls" button for manual demos. Requires CRON_SECRET when set.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return collect();
}

export async function GET(req: NextRequest) {
  return POST(req);
}

async function collect() {
  const db = supabase();
  const now = Math.floor(Date.now() / 1000);

  const { data: due, error } = await db
    .from("authorizations")
    .select("*, subscriptions!inner(status)")
    .eq("status", "pending")
    .eq("subscriptions.status", "active")
    .lte("valid_after", now)
    .gt("valid_before", now)
    .order("valid_after")
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { id: string; ok: boolean; txHash?: string; error?: string }[] = [];

  for (const auth of (due ?? []) as (AuthorizationRow & { subscriptions: { status: string } })[]) {
    // Claim the row so concurrent cron runs don't double-post it.
    const { data: claimed } = await db
      .from("authorizations")
      .update({ status: "posting" })
      .eq("id", auth.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed?.length) continue;

    const result = await executeAuthorization(auth);
    if (result.ok) {
      await db
        .from("authorizations")
        .update({ status: "posted", tx_hash: result.txHash, posted_at: new Date().toISOString(), error: null })
        .eq("id", auth.id);
      results.push({ id: auth.id, ok: true, txHash: result.txHash });
    } else {
      // Back to pending so the next cron retries while the window is open.
      await db
        .from("authorizations")
        .update({ status: "pending", error: result.error })
        .eq("id", auth.id);
      results.push({ id: auth.id, ok: false, error: result.error });
    }
  }

  // Mark subscriptions whose pulls are all posted as completed.
  const { data: actives } = await db
    .from("subscriptions")
    .select("id")
    .eq("status", "active");
  for (const s of actives ?? []) {
    const { count } = await db
      .from("authorizations")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", s.id)
      .in("status", ["pending", "posting"]);
    if (count === 0) {
      await db.from("subscriptions").update({ status: "completed" }).eq("id", s.id);
    }
  }

  return NextResponse.json({ collected: results.length, results });
}
