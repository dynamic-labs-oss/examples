// Creates a subscription plan on the Solana Subscriptions program (devnet).
//
//   npm run solana:create-plan
//   (= node --env-file=.env.local scripts/solana-create-plan.mjs)
//
// Reads from the environment (never hardcode a key here):
//   SOLANA_MERCHANT_PRIVATE_KEY      merchant keypair: base58 secret key or a JSON byte array.
//                                    It owns the plan, is the authorized puller, and signs
//                                    server-side collection. TESTNET ONLY.
//   NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS  must match that key's public address (sanity check)
//   SOLANA_PLAN_AMOUNT               per-period amount, base units (default 100000 = 0.10 USDC)
//   SOLANA_PLAN_PERIOD_HOURS         period in whole hours (default 1)
//   NEXT_PUBLIC_SOLANA_TOKEN_MINT    optional, defaults to Circle's devnet USDC
//   NEXT_PUBLIC_SOLANA_RPC_URL       optional, defaults to the public devnet RPC
//
// The merchant needs a little devnet SOL for fees (and rent for the plan
// account): https://faucet.solana.com. A plan's terms are immutable once
// subscribers join, so create a new plan for a different amount or period.

import {
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase58Encoder,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { findPlanPda, getCreatePlanOverlayInstructionAsync } from "@solana/subscriptions";

const env = process.env;
const need = (name) => {
  const v = env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

const raw = need("SOLANA_MERCHANT_PRIVATE_KEY").trim();
const secret = raw.startsWith("[")
  ? Uint8Array.from(JSON.parse(raw))
  : new Uint8Array(getBase58Encoder().encode(raw));
const merchant = await createKeyPairSignerFromBytes(secret);

if (env.NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS && env.NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS !== merchant.address) {
  throw new Error(
    `SOLANA_MERCHANT_PRIVATE_KEY is for ${merchant.address}, but NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS is ${env.NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS}`,
  );
}

const rpcUrl = env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const mint = address(env.NEXT_PUBLIC_SOLANA_TOKEN_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const amount = BigInt(env.SOLANA_PLAN_AMOUNT || "100000");
const periodHours = BigInt(env.SOLANA_PLAN_PERIOD_HOURS || "1");
if (amount <= 0n || periodHours < 1n) throw new Error("amount must be > 0 and period >= 1 hour");

const planId = crypto.getRandomValues(new BigUint64Array(1))[0];
const rpc = createSolanaRpc(rpcUrl);

const { value: balance } = await rpc.getBalance(merchant.address).send();
if (balance === 0n) {
  throw new Error(`Merchant ${merchant.address} has no devnet SOL. Fund it at https://faucet.solana.com and retry.`);
}

console.log("Creating Solana subscription plan (devnet)");
console.log("  merchant :", merchant.address);
console.log("  mint     :", mint);
console.log("  amount   :", amount.toString(), "base units per period");
console.log("  period   :", periodHours.toString(), "hour(s)");

const instruction = await getCreatePlanOverlayInstructionAsync({
  owner: merchant,
  planId,
  mint,
  amount,
  periodHours,
  endTs: 0n, // no end date
  destinations: [], // empty = pulls may go to the plan owner's token account
  pullers: [merchant.address], // the server collector signs as the merchant
  metadataUri: "",
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});

const { value: latest } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
const message = pipe(
  createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayerSigner(merchant, m),
  (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
  (m) => appendTransactionMessageInstructions([instruction], m),
);
const signed = await signTransactionMessageWithSigners(message);
const signature = getSignatureFromTransaction(signed);
await rpc.sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: "base64", preflightCommitment: "confirmed" }).send();
console.log("tx:", signature);

for (let i = 0; i < 30; i++) {
  const { value } = await rpc.getSignatureStatuses([signature]).send();
  const s = value[0];
  if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
    if (s.err) throw new Error(`Transaction failed: ${JSON.stringify(s.err, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
    const [planPda] = await findPlanPda({ owner: merchant.address, planId });
    console.log("\nPlan created.");
    console.log("  plan PDA :", planPda);
    console.log("  explorer : https://explorer.solana.com/tx/" + signature + "?cluster=devnet");
    console.log("\nSet in .env.local (and Vercel):");
    console.log("  NEXT_PUBLIC_SOLANA_MERCHANT_ADDRESS=" + merchant.address);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 1500));
}
throw new Error("Timed out waiting for confirmation; check the transaction on the explorer.");
