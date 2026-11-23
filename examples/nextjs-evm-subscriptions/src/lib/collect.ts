import { supabase, type AuthorizationRow } from "./supabase";
import { executePull } from "./collector";
import { TOKEN_ADDRESS } from "./config";
import { isAllowanceRevoked } from "./permit2-server";

export type CollectResults = {
  collected: number;
  results: { id: string; ok: boolean; txHash?: string; error?: string }[];
};

// A row claimed this long ago whose run never finished (serverless timeout,
// crash) is put back in the queue.
const STALE_CLAIM_MS = 10 * 60 * 1000;

// Collects due pulls: pending, past their due time, on an active
// subscription. With `subscriber` set, only that wallet's pulls are touched
// (used by the public "Collect due pulls" button); otherwise every due pull
// (used by the secret-protected schedule route).
export async function collectDue({
  subscriber,
  limit = 50,
}: { subscriber?: string; limit?: number } = {}): Promise<CollectResults> {
  const db = supabase();
  const now = Math.floor(Date.now() / 1000);

  // Recover rows stuck in 'posting'. Retrying is safe for funds: the plan
  // contract rejects an early pull and Permit2 caps the total, so the worst
  // case is one row's tx hash lining up with a neighbouring period.
  const cutoff = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  await db
    .from("authorizations")
    .update({ status: "pending" })
    .eq("status", "posting")
    .or(`claimed_at.is.null,claimed_at.lt.${cutoff}`);

  let query = db
    .from("authorizations")
    .select("*, subscriptions!inner(status, plan_contract, pulls_total, period_seconds)")
    .eq("status", "pending")
    .eq("subscriptions.status", "active")
    .lte("valid_after", now)
    .gt("valid_before", now)
    .order("valid_after")
    .limit(limit);
  if (subscriber) query = query.eq("from_address", subscriber.toLowerCase());

  const { data: due, error } = await query;
  if (error) throw new Error(error.message);

  const results: CollectResults["results"] = [];

  for (const auth of (due ?? []) as (AuthorizationRow & {
    subscriptions: {
      status: string;
      plan_contract: string | null;
      pulls_total: number | null;
      period_seconds: number;
    };
  })[]) {
    const plan = auth.subscriptions.plan_contract;

    // Claim the row so concurrent runs don't double-post it.
    const { data: claimed } = await db
      .from("authorizations")
      .update({ status: "posting", claimed_at: new Date().toISOString() })
      .eq("id", auth.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed?.length) continue;

    const result = await executePull(auth, plan);
    if (result.ok) {
      await db
        .from("authorizations")
        .update({ status: "posted", tx_hash: result.txHash, posted_at: new Date().toISOString(), error: null })
        .eq("id", auth.id);
      results.push({ id: auth.id, ok: true, txHash: result.txHash });

      // Open-ended subscription: schedule the next period. The unique
      // (subscription_id, nonce) makes this idempotent if two runs race.
      if (auth.subscriptions.pulls_total === null) {
        const next = auth.period_index + 1;
        await db.from("authorizations").upsert(
          {
            subscription_id: auth.subscription_id,
            period_index: next,
            from_address: auth.from_address,
            to_address: auth.to_address,
            value: auth.value,
            valid_after: auth.valid_after + auth.subscriptions.period_seconds,
            valid_before: auth.valid_before,
            nonce: `permit2:${next}`,
            status: "pending",
          },
          { onConflict: "subscription_id,nonce", ignoreDuplicates: true },
        );
      }
    } else {
      // A pull that fails because the subscriber revoked (or the allowance
      // expired / was used up) on-chain will never succeed — close the
      // subscription instead of retrying forever.
      if (await isAllowanceRevoked(auth.from_address as `0x${string}`, TOKEN_ADDRESS, plan).catch(() => false)) {
        await db
          .from("authorizations")
          .update({ status: "cancelled", error: "Allowance revoked or expired on-chain" })
          .eq("subscription_id", auth.subscription_id)
          .in("status", ["pending", "posting"]);
        await db.from("subscriptions").update({ status: "cancelled" }).eq("id", auth.subscription_id);
        results.push({ id: auth.id, ok: false, error: "Allowance revoked or expired — subscription cancelled" });
        continue;
      }
      // Back to pending so the next run retries.
      await db
        .from("authorizations")
        .update({ status: "pending", error: result.error })
        .eq("id", auth.id);
      results.push({ id: auth.id, ok: false, error: result.error });
    }
  }

  // Mark subscriptions whose pulls are all posted as completed.
  let activeQuery = db.from("subscriptions").select("id, pulls_total").eq("status", "active");
  if (subscriber) activeQuery = activeQuery.eq("subscriber", subscriber.toLowerCase());
  const { data: actives } = await activeQuery;
  for (const s of actives ?? []) {
    if (s.pulls_total === null) continue; // open-ended: never "completed"
    const { count } = await db
      .from("authorizations")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", s.id)
      .in("status", ["pending", "posting"]);
    if (count === 0) {
      await db.from("subscriptions").update({ status: "completed" }).eq("id", s.id);
    }
  }

  return { collected: results.length, results };
}
