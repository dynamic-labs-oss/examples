import { address, createClient, createNoopSigner } from "@solana/kit";
import { solanaDevnetRpc } from "@solana/kit-plugin-rpc";
import { signer } from "@solana/kit-plugin-signer";
import { subscriptionsProgram } from "@solana/subscriptions";
import { SOLANA_RPC_URL } from "./config";

// A Kit client with the Subscriptions plugin, used to BUILD instructions.
//
// The plugin's `subscriptions.instructions.*` fetch what the bare overlay
// builders can't: `subscribe` reads the live plan terms (amount, period,
// createdAt) and the subscriber's authority init id, so the transaction
// commits to exactly what's on-chain. The signer is a no-op placeholder;
// the Dynamic wallet does the real signing in tx.ts.
export function subscriptionsClient(userAddress: string) {
  return createClient()
    .use(signer(createNoopSigner(address(userAddress))))
    .use(solanaDevnetRpc({ rpcUrl: SOLANA_RPC_URL }))
    .use(subscriptionsProgram());
}
