import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client. Uses the secret API key so API routes can
// read/write without RLS — never expose it to the browser.
let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
    }
    _client = createClient(url, key);
  }
  return _client;
}

export type SubscriptionStatus = "active" | "cancelled" | "completed";
export type AuthorizationStatus = "pending" | "posting" | "posted" | "failed" | "cancelled";

export type SubscriptionRow = {
  id: string;
  subscriber: string;
  merchant: string;
  chain_id: number;
  token_address: string;
  amount: string;
  period_seconds: number;
  pulls_total: number | null; // null = open-ended ("until cancelled")
  status: SubscriptionStatus;
  mode: "permit2" | "eip3009";
  plan_contract: string | null; // permit2 only
  created_at: string;
};

// One scheduled pull. (The table keeps its original name.) In Permit2 mode a
// row is one period the collector executes via plan.pull(subscriber); in
// EIP-3009 mode it is one stored, pre-signed authorization.
export type AuthorizationRow = {
  id: string;
  subscription_id: string;
  period_index: number;
  from_address: string;
  to_address: string;
  value: string;
  valid_after: number;
  valid_before: number;
  nonce: string; // "permit2:<index>", or the EIP-3009 bytes32 nonce — unique per subscription
  signature: string | null; // EIP-3009 only; never sent to the browser
  executor: "permit2" | "direct" | "relay";
  relay: Record<string, unknown> | null; // EIP-3009 via Relay only
  status: AuthorizationStatus;
  tx_hash: string | null;
  error: string | null;
  posted_at: string | null;
  claimed_at: string | null;
  created_at: string;
};
