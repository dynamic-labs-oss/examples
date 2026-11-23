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
  pulls_total: number;
  status: SubscriptionStatus;
  created_at: string;
};

export type AuthorizationRow = {
  id: string;
  subscription_id: string;
  period_index: number;
  from_address: string;
  to_address: string;
  value: string;
  valid_after: number;
  valid_before: number;
  nonce: string;
  signature: string;
  status: AuthorizationStatus;
  tx_hash: string | null;
  error: string | null;
  posted_at: string | null;
  executor: "direct" | "relay";
  relay: Record<string, unknown> | null;
  created_at: string;
};
