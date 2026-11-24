// Server-only: reads SOLANA_MERCHANT_PRIVATE_KEY. Only import from API routes.
import {
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  getBase58Encoder,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  fetchDelegationsByDelegatee,
  fetchPlansForOwner,
  getTransferSubscriptionOverlayInstructionAsync,
  PlanStatus,
  type PlanWithAddress,
  type SubscriptionDelegation,
} from "@solana/subscriptions";
import { SOLANA_MERCHANT_ADDRESS, SOLANA_TOKEN_MINT } from "./config";
import { confirmSignature, solanaRpc } from "./rpc";

export type SolanaCollectResult = {
  subscription: string;
  subscriber: string;
  amount: string;
} & ({ ok: true; signature: string } | { ok: false; error: string });

// The server-side merchant key. It must be the plan owner or one of the plan's
// `pullers`. Accepts a base58 secret key (64 bytes) or a JSON byte array.
// TESTNET ONLY — in production use a secrets manager or MPC signing.
async function merchantSigner(): Promise<KeyPairSigner> {
  const raw = process.env.SOLANA_MERCHANT_PRIVATE_KEY;
  if (!raw) throw new Error("SOLANA_MERCHANT_PRIVATE_KEY is not set");
  const bytes = raw.trim().startsWith("[")
    ? Uint8Array.from(JSON.parse(raw) as number[])
    : new Uint8Array(getBase58Encoder().encode(raw.trim()));
  return createKeyPairSignerFromBytes(bytes);
}

// How much of a subscription can be pulled right now (0n = nothing due).
// The program lets the merchant pull up to `amount` per period; once the
// period has elapsed the allowance resets.
export function dueAmount(sub: SubscriptionDelegation, nowSec: bigint): bigint {
  if (sub.expiresAtTs > 0n && nowSec >= sub.expiresAtTs) return 0n; // cancelled and ended
  const periodSec = sub.terms.periodHours * 3600n;
  if (nowSec >= sub.currentPeriodStartTs + periodSec) return sub.terms.amount; // new period
  const remaining = sub.terms.amount - sub.amountPulledInPeriod;
  return remaining > 0n ? remaining : 0n;
}

// Collects every due pull for the merchant's active plans (optionally just
// one subscriber). Chain state is the source of truth, so no database needed.
export async function collectSolanaDue(opts: { subscriber?: string; limit?: number } = {}) {
  if (!SOLANA_MERCHANT_ADDRESS) throw new Error("NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS is not set");
  const { subscriber, limit = 50 } = opts;
  const rpc = solanaRpc();
  const signer = await merchantSigner();
  if (signer.address !== SOLANA_MERCHANT_ADDRESS) {
    throw new Error("SOLANA_MERCHANT_PRIVATE_KEY does not match NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS");
  }
  const mint = address(SOLANA_TOKEN_MINT);
  const nowSec = BigInt(Math.floor(Date.now() / 1000));

  const plans = (await fetchPlansForOwner(rpc, address(SOLANA_MERCHANT_ADDRESS))).filter(
    (p: PlanWithAddress) => p.data.status === PlanStatus.Active || p.data.status === PlanStatus.Sunset,
  );

  const [receiverAta] = await findAssociatedTokenPda({
    mint,
    owner: signer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const results: SolanaCollectResult[] = [];
  for (const plan of plans) {
    if (plan.data.data.mint !== mint) continue;
    const delegations = await fetchDelegationsByDelegatee(rpc, plan.address);
    for (const d of delegations) {
      if (d.kind !== "subscription") continue;
      if (subscriber && d.data.header.delegator !== subscriber) continue;
      const amount = dueAmount(d.data, nowSec);
      if (amount <= 0n) continue;
      if (results.length >= limit) return { collected: results.length, results };

      const base = { subscription: d.address as string, subscriber: d.data.header.delegator as string, amount: amount.toString() };
      try {
        const signature = await pull(signer, {
          planPda: plan.address,
          subscriptionPda: d.address,
          delegator: d.data.header.delegator,
          receiverAta,
          mint,
          amount,
        });
        results.push({ ...base, ok: true, signature });
      } catch (err) {
        results.push({ ...base, ok: false, error: shortError(err) });
      }
    }
  }
  return { collected: results.length, results };
}

async function pull(
  signer: KeyPairSigner,
  a: { planPda: ReturnType<typeof address>; subscriptionPda: ReturnType<typeof address>; delegator: ReturnType<typeof address>; receiverAta: ReturnType<typeof address>; mint: ReturnType<typeof address>; amount: bigint },
): Promise<string> {
  const rpc = solanaRpc();
  const { value: latest } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const instructions: Instruction[] = [
    // Make sure the merchant's token account exists (no-op if it does).
    getCreateAssociatedTokenIdempotentInstruction({
      payer: signer,
      ata: a.receiverAta,
      owner: signer.address,
      mint: a.mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }) as unknown as Instruction,
    await getTransferSubscriptionOverlayInstructionAsync({
      caller: signer,
      subscriptionPda: a.subscriptionPda,
      planPda: a.planPda,
      delegator: a.delegator,
      receiverAta: a.receiverAta,
      tokenMint: a.mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      amount: a.amount,
    }),
  ];
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(signed);
  await rpc
    .sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: "base64", preflightCommitment: "confirmed" })
    .send();
  await confirmSignature(rpc, signature);
  return signature;
}

function shortError(err: unknown): string {
  const cause = (err as { cause?: { message?: string } })?.cause?.message;
  const msg = cause ?? (err instanceof Error ? err.message : String(err));
  return msg.split("\n").join(" ").slice(0, 300);
}
