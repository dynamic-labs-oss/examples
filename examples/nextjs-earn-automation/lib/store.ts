import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";

/** A user's delegation grant, delivered by the wallet.delegation.created webhook. */
export type DelegationRecord = {
  userId: string;
  chain: string;
  walletId: string;
  address: string;
  /** AES-256-GCM encrypted at rest (see lib/crypto.ts). */
  delegatedShareEnc: string;
  walletApiKeyEnc: string;
  shareSetId?: string;
  createdAt: string;
};

export type AutomationRule = {
  id: string;
  userId: string;
  walletAddress: string;
  walletId: string;
  vaultId: string;
  chainId: number;
  assetAddress: string;
  assetSymbol: string;
  assetDecimals: number;
  mode: "sweep" | "fixed";
  /** Human-readable amount, fixed mode only. */
  amount?: string;
  sponsored: boolean;
  /** Native units a native-asset sweep leaves behind for gas. */
  gasReserve: string;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
};

export type AutomationRun = {
  id: string;
  ruleId: string;
  status: "deposited" | "skipped" | "failed";
  amount?: string;
  txHash?: string;
  reason?: string;
  createdAt: string;
};

type DbShape = {
  delegations: DelegationRecord[];
  rules: AutomationRule[];
  runs: AutomationRun[];
};

interface Store {
  getDelegation(address: string): Promise<DelegationRecord | undefined>;
  putDelegation(record: DelegationRecord): Promise<void>;
  deleteDelegation(userId: string, chain: string): Promise<boolean>;
  listRules(userId?: string): Promise<AutomationRule[]>;
  getRule(id: string): Promise<AutomationRule | undefined>;
  putRule(rule: AutomationRule): Promise<void>;
  deleteRule(id: string): Promise<void>;
  addRun(run: AutomationRun): Promise<void>;
  listRuns(ruleIds: string[]): Promise<AutomationRun[]>;
}

// ---------------------------------------------------------------------------
// File-backed store (default for local dev — no Supabase needed)
// ---------------------------------------------------------------------------

const DATA_FILE = path.join(process.cwd(), ".data", "db.json");

async function readFile(): Promise<DbShape> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as DbShape;
  } catch {
    return { delegations: [], rules: [], runs: [] };
  }
}

async function writeFile(db: DbShape): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2));
}

const fileStore: Store = {
  async getDelegation(address) {
    const db = await readFile();
    return db.delegations.find(
      (d) => d.address.toLowerCase() === address.toLowerCase()
    );
  },
  async putDelegation(record) {
    const db = await readFile();
    db.delegations = [
      ...db.delegations.filter(
        (d) =>
          !(
            d.address.toLowerCase() === record.address.toLowerCase() &&
            d.chain === record.chain
          )
      ),
      record,
    ];
    await writeFile(db);
  },
  async deleteDelegation(userId, chain) {
    const db = await readFile();
    const before = db.delegations.length;
    db.delegations = db.delegations.filter(
      (d) => !(d.userId === userId && d.chain === chain)
    );
    await writeFile(db);
    return db.delegations.length !== before;
  },
  async listRules(userId) {
    const db = await readFile();
    return userId ? db.rules.filter((r) => r.userId === userId) : db.rules;
  },
  async getRule(id) {
    const db = await readFile();
    return db.rules.find((r) => r.id === id);
  },
  async putRule(rule) {
    const db = await readFile();
    db.rules = [...db.rules.filter((r) => r.id !== rule.id), rule];
    await writeFile(db);
  },
  async deleteRule(id) {
    const db = await readFile();
    db.rules = db.rules.filter((r) => r.id !== id);
    await writeFile(db);
  },
  async addRun(run) {
    const db = await readFile();
    db.runs.push(run);
    await writeFile(db);
  },
  async listRuns(ruleIds) {
    const db = await readFile();
    return db.runs
      .filter((r) => ruleIds.includes(r.ruleId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};

// ---------------------------------------------------------------------------
// Supabase store — same tables as supabase/schema.sql
// ---------------------------------------------------------------------------

function supabaseStore(): Store {
  const sb: SupabaseClient = createClient(
    env.SUPABASE_URL as string,
    env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const must = <T>(p: PromiseLike<{ data: T; error: { message: string } | null }>) =>
    p.then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return data;
    });

  return {
    async getDelegation(address) {
      const rows = await must(
        sb
          .from("delegations")
          .select("*")
          .ilike("address", address)
          .limit(1)
      );
      return (rows as DelegationRecord[])[0];
    },
    async putDelegation(record) {
      await must(
        sb
          .from("delegations")
          .upsert(record, { onConflict: "address,chain" })
      );
    },
    async deleteDelegation(userId, chain) {
      const rows = await must(
        sb
          .from("delegations")
          .delete()
          .eq("userId", userId)
          .eq("chain", chain)
          .select("address")
      );
      return (rows as unknown[]).length > 0;
    },
    async listRules(userId) {
      let q = sb.from("rules").select("*");
      if (userId) q = q.eq("userId", userId);
      return (await must(q)) as AutomationRule[];
    },
    async getRule(id) {
      const rows = await must(
        sb.from("rules").select("*").eq("id", id).limit(1)
      );
      return (rows as AutomationRule[])[0];
    },
    async putRule(rule) {
      await must(sb.from("rules").upsert(rule));
    },
    async deleteRule(id) {
      await must(sb.from("rules").delete().eq("id", id));
    },
    async addRun(run) {
      await must(sb.from("runs").insert(run));
    },
    async listRuns(ruleIds) {
      return (await must(
        sb
          .from("runs")
          .select("*")
          .in("ruleId", ruleIds.length ? ruleIds : ["-"])
          .order("createdAt", { ascending: false })
      )) as AutomationRun[];
    },
  };
}

let cached: Store | undefined;
export function getStore(): Store {
  if (!cached) {
    cached =
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? supabaseStore()
        : fileStore;
  }
  return cached;
}
