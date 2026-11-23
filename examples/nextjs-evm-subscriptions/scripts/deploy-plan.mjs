// Deploys the SubscriptionPlan contract to Base Sepolia.
//
//   node --env-file=.env.local scripts/deploy-plan.mjs
//
// Reads from the environment (never hardcode a key here):
//   RELAYER_PRIVATE_KEY            deployer / gas payer (testnet-only key!)
//   NEXT_PUBLIC_MERCHANT_ADDRESS   immutable recipient of every pull
//   NEXT_PUBLIC_PLAN_AMOUNT        per-pull amount, base units (default 100000 = 0.10 USDC)
//   NEXT_PUBLIC_PLAN_PERIOD_SECONDS  period (default 3600)
//   NEXT_PUBLIC_TOKEN_ADDRESS      optional, defaults to Base Sepolia USDC
//   RPC_URL                        optional
//
// Prints the address to put in NEXT_PUBLIC_PLAN_CONTRACT. The plan's terms are
// immutable — to change merchant/amount/period, deploy a new plan.

import { createPublicClient, createWalletClient, getAddress, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { compilePlan } from "./compile-plan.mjs";

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const env = process.env;

function need(name) {
  const v = env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const merchant = need("NEXT_PUBLIC_MERCHANT_ADDRESS");
if (!isAddress(merchant) || /^0x0+$/.test(merchant)) throw new Error("NEXT_PUBLIC_MERCHANT_ADDRESS is not a real address");
const token = env.NEXT_PUBLIC_TOKEN_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const amount = BigInt(env.NEXT_PUBLIC_PLAN_AMOUNT || "100000");
const period = Number(env.NEXT_PUBLIC_PLAN_PERIOD_SECONDS || "3600");

const account = privateKeyToAccount(need("RELAYER_PRIVATE_KEY"));
const transport = http(env.RPC_URL);
const publicClient = createPublicClient({ chain: baseSepolia, transport });
const wallet = createWalletClient({ account, chain: baseSepolia, transport });

const permit2Code = await publicClient.getCode({ address: PERMIT2 });
if (!permit2Code || permit2Code === "0x") throw new Error("Permit2 is not deployed on this chain");

const { abi, bytecode } = compilePlan();

console.log("Deploying SubscriptionPlan to Base Sepolia");
console.log("  deployer :", account.address);
console.log("  permit2  :", PERMIT2);
console.log("  token    :", getAddress(token));
console.log("  merchant :", getAddress(merchant));
console.log("  amount   :", amount.toString(), "base units per pull");
console.log("  period   :", period, "seconds");

const hash = await wallet.deployContract({
  abi,
  bytecode,
  args: [PERMIT2, getAddress(token), getAddress(merchant), amount, period],
});
console.log("tx:", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("deployment failed");

console.log("\nDeployed:", receipt.contractAddress);
console.log(`Explorer: https://sepolia.basescan.org/address/${receipt.contractAddress}`);
console.log("\nAdd this line to .env.local and restart the dev server:");
console.log(`NEXT_PUBLIC_PLAN_CONTRACT=${receipt.contractAddress}`);
