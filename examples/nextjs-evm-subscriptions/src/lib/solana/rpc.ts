import { createSolanaRpc } from "@solana/kit";
import { SOLANA_RPC_URL } from "./config";

// One devnet RPC for everything (reads, sending, the collector). We sign with
// the Dynamic wallet but submit through this endpoint ourselves, so the app
// does not depend on which Solana network the wallet happens to be set to.
// The public devnet RPC supports getProgramAccounts, which the plan and
// subscription lookups need.
export function solanaRpc() {
  return createSolanaRpc(SOLANA_RPC_URL);
}

export type SolanaRpc = ReturnType<typeof solanaRpc>;

// Polls until the signature is confirmed (or throws if it failed on-chain).
export async function confirmSignature(rpc: SolanaRpc, signature: string, timeoutMs = 45_000) {
  const sig = signature as Parameters<SolanaRpc["getSignatureStatuses"]>[0][number];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { value } = await rpc.getSignatureStatuses([sig]).send();
    const status = value[0];
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      if (status.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Timed out waiting for confirmation (the transaction may still land)");
}
