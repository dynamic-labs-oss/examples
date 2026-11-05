/**
 * The agent — runs server-side, no UI, no human in the loop.
 *
 * Given a user who has funded and authorized their account on the website, the
 * agent:
 *   1. loads the user's delegated wallet credentials from Supabase (decrypting them),
 *   2. checks the spendable USD balance,
 *   3. if empty, points the user to the funding page and stops,
 *   4. otherwise pays an x402-protected "cloud service" — a gasless USDC payment
 *      signed inside Dynamic's MPC — and uses the result.
 *
 * Everything is logged in USD. Run with: pnpm agent
 */
import "dotenv/config";
import { createPublicClient, http } from "viem";
import { wrapFetchWithPayment } from "x402-fetch";
import {
  ERC20_BALANCE_ABI,
  USDC_ADDRESS,
  VIEM_CHAIN,
  RPC_URL,
  DELEGATION_CHAIN,
  formatUsd,
} from "../lib/shared/constants";
import {
  getDelegationByAddress,
  getDelegationByCode,
  type DelegationRecord,
} from "../lib/shared/delegation-store";
import { createDynamicX402Account } from "../lib/shared/x402-account";

const SERVICE_URL =
  process.env.X402_SERVICE_URL ??
  "http://localhost:3000/api/services/azure-compute";
const FUNDING_URL = process.env.FUNDING_URL ?? "http://localhost:3000";
const PRICE_USD_BASE_UNITS = BigInt(10_000); // $0.01 in USDC (6 decimals)

async function loadDelegation(): Promise<DelegationRecord> {
  // Production: the agent acts on a specific user's wallet, identified by the
  // short account code (or address) — resolved from the webhook-populated store.
  //   pnpm agent <accountCode>     (e.g. the code shown on the funding page)
  //   pnpm agent <0xWalletAddress> (or set AGENT_ACCOUNT)
  const selector =
    process.env.AGENT_ACCOUNT ?? process.argv[2] ?? process.env.AGENT_WALLET_ADDRESS;
  if (!selector) {
    throw new Error(
      "Specify which account to act for: `pnpm agent <accountCode|walletAddress>` " +
        "(or set AGENT_ACCOUNT). The agent resolves it to the user's delegated " +
        "wallet from the store the webhook populates."
    );
  }

  const delegation = selector.startsWith("0x")
    ? await getDelegationByAddress(selector, DELEGATION_CHAIN)
    : await getDelegationByCode(selector, DELEGATION_CHAIN);

  if (!delegation) {
    throw new Error(
      `No delegation found for "${selector}". Has the user authorized the agent ` +
        "(and did the Dynamic webhook store it)?"
    );
  }
  return delegation;
}

async function getBalanceBaseUnits(address: string): Promise<bigint> {
  const client = createPublicClient({
    chain: VIEM_CHAIN,
    transport: http(RPC_URL),
  });
  return client.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });
}

async function main() {
  console.log("🤖 Agent starting…\n");

  const delegation = await loadDelegation();
  console.log(`Account ${delegation.code} → wallet ${delegation.address}`);

  // 1. Check funds
  const balance = await getBalanceBaseUnits(delegation.address);
  console.log(`Balance: $${formatUsd(balance)}`);

  if (balance < PRICE_USD_BASE_UNITS) {
    console.log(
      `\n⚠️  Not enough funds to pay for the service ($${formatUsd(
        PRICE_USD_BASE_UNITS
      )}).`
    );
    console.log(`👉 Ask the user to add funds at: ${FUNDING_URL}\n`);
    return;
  }

  // 2. Build an x402 signer backed by the delegated MPC wallet (gasless EIP-3009).
  const account = createDynamicX402Account(delegation);
  const fetchWithPayment = wrapFetchWithPayment(fetch, account);

  // 3. Pay for the service. x402 handles the 402 → sign → retry handshake.
  console.log(`\n💳 Paying for service: ${SERVICE_URL}`);
  const res = await fetchWithPayment(SERVICE_URL, { method: "GET" });

  if (!res.ok) {
    console.error(`Service call failed: HTTP ${res.status}`);
    console.error(await res.text());
    process.exitCode = 1;
    return;
  }

  const result = await res.json();
  console.log("\n✅ Service delivered (paid $0.01):");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("\n❌ Agent error:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
