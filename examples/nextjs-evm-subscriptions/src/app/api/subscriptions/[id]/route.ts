import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAllowanceRevoked } from "@/lib/permit2-server";

// DELETE /api/subscriptions/{id}?subscriber=0x... — record a cancellation.
//
// A subscription is only really cancelled once the subscriber has zeroed the
// Permit2 allowance on-chain (the plan contract's `pull` is permissionless, so
// a database flag alone wouldn't stop a pull). The UI sends that revoke
// transaction from the subscriber's wallet first, then calls this endpoint,
// which refuses until the allowance is actually gone. That also means nobody
// else can "cancel" someone's subscription by calling this.
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

  const revoked = await isAllowanceRevoked(
    subscriber as `0x${string}`,
    sub.token_address as `0x${string}`,
    sub.plan_contract,
  );
  if (!revoked) {
    return NextResponse.json(
      { error: "Revoke the Permit2 allowance from your wallet first, then cancel." },
      { status: 409 },
    );
  }

  await db
    .from("authorizations")
    .update({ status: "cancelled" })
    .eq("subscription_id", id)
    .eq("status", "pending");
  await db.from("subscriptions").update({ status: "cancelled" }).eq("id", id);

  return NextResponse.json({ ok: true });
}
