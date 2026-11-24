import type { Hex } from "viem";
import { PLAN_ABI } from "./permit2";
import { relayerWallet, rpc } from "./permit2-server";
import type { AuthorizationRow } from "./supabase";

export type CollectResult = { ok: true; txHash: string } | { ok: false; error: string };

// Executes one due pull by calling plan.pull(subscriber) from the relayer.
//
// The plan contract enforces the cadence, the amount and the recipient
// on-chain; this only triggers it. If the pull isn't due yet, or the
// allowance was revoked or used up, the call reverts during simulation,
// nothing is sent, and the caller leaves the row pending to retry.
export async function executePull(
  auth: AuthorizationRow,
  planContract: string | null | undefined,
): Promise<CollectResult> {
  if (!planContract) return { ok: false, error: "Subscription has no plan_contract" };
  try {
    const hash = await relayerWallet().writeContract({
      address: planContract as Hex,
      abi: PLAN_ABI,
      functionName: "pull",
      args: [auth.from_address as Hex],
    });
    const receipt = await rpc().waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") return { ok: false, error: `pull reverted (${hash})` };
    return { ok: true, txHash: hash };
  } catch (err) {
    // viem's shortMessage keeps the revert reason on one line; the full
    // message embeds the whole request body.
    const msg =
      (err as { shortMessage?: string }).shortMessage ?? (err instanceof Error ? err.message : String(err));
    return { ok: false, error: msg.split("\n").join(" ").slice(0, 300) };
  }
}
