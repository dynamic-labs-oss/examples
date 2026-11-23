import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// DELETE /api/subscriptions/{id}?subscriber=0x... — cancel: voids every
// pending authorization so the cron never posts them. Already-posted auths
// are unaffected (same semantics as the Solana cancel flow, which only
// blocks future pulls).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subscriber = req.nextUrl.searchParams.get("subscriber")?.toLowerCase();
  if (!subscriber) {
    return NextResponse.json({ error: "subscriber is required" }, { status: 400 });
  }

  const db = supabase();
  const { data: sub, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .eq("subscriber", subscriber)
    .single();
  if (error || !sub) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  await db
    .from("authorizations")
    .update({ status: "cancelled" })
    .eq("subscription_id", id)
    .eq("status", "pending");
  await db.from("subscriptions").update({ status: "cancelled" }).eq("id", id);

  return NextResponse.json({ ok: true });
}
