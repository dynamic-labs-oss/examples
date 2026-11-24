import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CHAIN_ID } from "@/lib/config";
import { HttpError, Permit2SubscribeBody, activatePermit2Subscription } from "@/lib/permit2-server";
import { Eip3009SubscribeBody, validateEip3009Subscription } from "@/lib/eip3009-server";

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

// POST /api/subscriptions — two modes, chosen by `mode` in the body:
//
//  permit2 (default): the browser sends ONE signed Permit2 PermitSingle. The
//    server validates it, activates it on the plan contract (the relayer pays
//    gas; Permit2 verifies the subscriber's signature), then records the
//    schedule. Body: { subscriber, permit, signature }.
//  eip3009: the browser sends N pre-signed TransferWithAuthorization messages,
//    one per period. The server verifies and stores them; the collector
//    broadcasts each in its window. Body: { mode: "eip3009", subscriber, auths }.
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  if ((json as { mode?: unknown } | null)?.mode === "eip3009") return createEip3009(json);
  return createPermit2(json);
}

async function createEip3009(json: unknown) {
  const parsed = Eip3009SubscribeBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }
  let v;
  try {
    v = await validateEip3009Subscription(parsed.data);
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Validation failed" }, { status: 500 });
  }

  const db = supabase();
  const { data: sub, error } = await db
    .from("subscriptions")
    .insert({
      subscriber: v.subscriber,
      merchant: v.merchant,
      chain_id: CHAIN_ID,
      token_address: v.token,
      amount: v.amount.toString(),
      period_seconds: v.periodSeconds,
      pulls_total: v.rows.length,
      status: "active",
      mode: "eip3009",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: rowsError } = await db
    .from("authorizations")
    .insert(v.rows.map((r) => ({ ...r, subscription_id: sub.id, status: "pending" })));
  if (rowsError) {
    await db.from("subscriptions").delete().eq("id", sub.id);
    return NextResponse.json({ error: rowsError.message }, { status: 500 });
  }
  return NextResponse.json({ subscription: sub }, { status: 201 });
}

async function createPermit2(json: unknown) {
  const parsed = Permit2SubscribeBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const subscriber = body.subscriber.toLowerCase();

  let plan;
  try {
    plan = await activatePermit2Subscription(body);
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Activation failed" }, { status: 500 });
  }

  const db = supabase();
  // Re-subscribing restarts the on-chain schedule, so retire earlier ones.
  const { data: older } = await db
    .from("subscriptions")
    .select("id")
    .eq("subscriber", subscriber)
    .eq("plan_contract", plan.planContract.toLowerCase())
    .eq("status", "active");
  for (const o of older ?? []) {
    await db.from("authorizations").update({ status: "cancelled" }).eq("subscription_id", o.id).eq("status", "pending");
    await db.from("subscriptions").update({ status: "cancelled" }).eq("id", o.id);
  }

  const { data: sub, error } = await db
    .from("subscriptions")
    .insert({
      subscriber,
      merchant: plan.merchant.toLowerCase(),
      chain_id: CHAIN_ID,
      token_address: plan.token,
      amount: plan.amount.toString(),
      period_seconds: plan.periodSeconds,
      pulls_total: plan.pulls, // null = open-ended
      status: "active",
      mode: "permit2",
      plan_contract: plan.planContract.toLowerCase(),
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json(
      { error: `${error.message} (permit already activated on-chain: ${plan.txHash})` },
      { status: 500 },
    );
  }

  // One schedule row per pull. The contract enforces the cadence; these rows
  // tell the collector when to call plan.pull(subscriber). The window stays
  // open until the allowance expires so a late run still catches up.
  // Open-ended subscriptions start with just the first row; the collector
  // appends the next period's row after each successful pull.
  const rows = Array.from({ length: plan.pulls ?? 1 }, (_, i) => ({
    subscription_id: sub.id,
    period_index: i,
    from_address: subscriber,
    to_address: plan.merchant.toLowerCase(),
    value: plan.amount.toString(),
    valid_after: plan.start + i * plan.periodSeconds,
    valid_before: plan.expiration,
    nonce: `permit2:${i}`,
    executor: "permit2",
    status: "pending",
  }));
  const { error: rowsError } = await db.from("authorizations").insert(rows);
  if (rowsError) {
    await db.from("subscriptions").delete().eq("id", sub.id);
    return NextResponse.json(
      { error: `${rowsError.message} (permit already activated on-chain: ${plan.txHash})` },
      { status: 500 },
    );
  }

  return NextResponse.json({ subscription: sub, activationTx: plan.txHash }, { status: 201 });
}
