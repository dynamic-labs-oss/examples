import { NextRequest, NextResponse } from "next/server";
import { supabase, type AuthorizationRow } from "@/lib/supabase";
import { CHAIN_ID, MERCHANT_ADDRESS, PLAN, TOKEN_ADDRESS } from "@/lib/config";
import type { SignedAuthorization } from "@/lib/eip3009";

// GET /api/subscriptions?subscriber=0x... — the payer's subscriptions with
// the status of each scheduled pull.
export async function GET(req: NextRequest) {
  const subscriber = req.nextUrl.searchParams.get("subscriber")?.toLowerCase();
  if (!subscriber) {
    return NextResponse.json({ error: "subscriber is required" }, { status: 400 });
  }
  const db = supabase();
  const { data: subs, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("subscriber", subscriber)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (subs ?? []).map((s) => s.id);
  const { data: auths } = ids.length
    ? await db
        .from("authorizations")
        .select("id,subscription_id,period_index,valid_after,valid_before,status,tx_hash,error,posted_at")
        .in("subscription_id", ids)
        .order("period_index")
    : { data: [] };

  const bySub: Record<string, unknown[]> = {};
  for (const a of auths ?? []) {
    (bySub[a.subscription_id as string] ??= []).push(a);
  }
  return NextResponse.json(
    (subs ?? []).map((s) => ({ ...s, authorizations: bySub[s.id] ?? [] })),
  );
}

// POST /api/subscriptions — store a subscription and its pre-signed
// authorizations. Body: { subscriber, auths: SignedAuthorization[] }.
export async function POST(req: NextRequest) {
  if (!MERCHANT_ADDRESS) {
    return NextResponse.json({ error: "Merchant address not configured" }, { status: 500 });
  }
  const { subscriber, auths } = (await req.json()) as {
    subscriber: `0x${string}`;
    auths: SignedAuthorization[];
  };
  if (!subscriber || !Array.isArray(auths) || auths.length === 0) {
    return NextResponse.json({ error: "subscriber and auths are required" }, { status: 400 });
  }

  const db = supabase();
  const { data: sub, error } = await db
    .from("subscriptions")
    .insert({
      subscriber: subscriber.toLowerCase(),
      merchant: MERCHANT_ADDRESS.toLowerCase(),
      chain_id: CHAIN_ID,
      token_address: TOKEN_ADDRESS,
      amount: auths[0].value,
      period_seconds: auths.length > 1 ? auths[1].validAfter - auths[0].validAfter : PLAN.periodSeconds,
      pulls_total: auths.length,
      status: "active",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = auths.map((a, i) => ({
    subscription_id: sub.id,
    period_index: i,
    from_address: a.from.toLowerCase(),
    to_address: a.to.toLowerCase(),
    value: a.value,
    valid_after: a.validAfter,
    valid_before: a.validBefore,
    nonce: a.nonce,
    signature: a.signature,
    status: "pending",
    executor: a.executor,
    relay: a.relay ?? null,
  }));
  const { error: authError } = await db.from("authorizations").insert(rows);
  if (authError) {
    await db.from("subscriptions").delete().eq("id", sub.id);
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ subscription: sub }, { status: 201 });
}
