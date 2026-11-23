// End-to-end simulation of the Permit2 subscription flow — no deployment, no
// keys, no funds. Runs the *compiled* SubscriptionPlan bytecode against the
// REAL Permit2 and USDC on Base Sepolia using eth_simulateV1 with state
// overrides (fake USDC balance for a throwaway subscriber, block-time jumps).
//
//   node scripts/simulate-plan.mjs        (optionally RPC_URL=...)
//
// Checks: the EIP-712 PermitSingle encoding is accepted by real Permit2,
// pulls are due on the on-chain schedule (not early), each pull moves exactly
// one period's amount to the merchant, the permit total caps the count, and a
// revoke (Permit2.approve(.., 0, 0)) stops further pulls.

import {
  createPublicClient,
  decodeErrorResult,
  encodeAbiParameters,
  encodeDeployData,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  maxUint256,
  pad,
  toHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { compilePlan } from "./compile-plan.mjs";

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const MERCHANT = getAddress("0x00000000000000000000000000000000000Ae7c4");
const PLAN = getAddress("0x00000000000000000000000000000000000c0de0");
const RELAYER = getAddress("0x0000000000000000000000000000000000001234");
const AMOUNT = 100000n; // 0.10 USDC
const PERIOD = 3600;
const PULLS = 4;

const ERC20 = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
];
const PERMIT2_ABI = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "address" }], outputs: [{ type: "uint160" }, { type: "uint48" }, { type: "uint48" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "address" }, { type: "uint160" }, { type: "uint48" }], outputs: [] },
  { type: "error", name: "InsufficientAllowance", inputs: [{ type: "uint256" }] },
  { type: "error", name: "AllowanceExpired", inputs: [{ type: "uint256" }] },
];

// Same typed data as src/lib/permit2.ts (kept in sync by hand).
const PERMIT_TYPES = {
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
};

const { abi, bytecode } = compilePlan();
const planAbi = [
  ...abi,
  { type: "error", name: "InsufficientAllowance", inputs: [{ type: "uint256" }] },
];

const urls = process.env.RPC_URL ? [process.env.RPC_URL] : ["https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com"];

let client;
for (const url of urls) {
  const c = createPublicClient({ chain: baseSepolia, transport: http(url) });
  try {
    await c.simulateBlocks({ blocks: [{ calls: [] }] });
    client = c;
    console.log("RPC with eth_simulateV1:", url);
    break;
  } catch {
    console.log("RPC without eth_simulateV1 support:", url);
  }
}
if (!client) {
  console.error("No RPC supporting eth_simulateV1 found — set RPC_URL to one that does.");
  process.exit(2);
}

// ── set up ────────────────────────────────────────────────────────────────
const initCode = encodeDeployData({ abi, bytecode, args: [PERMIT2, USDC, MERCHANT, AMOUNT, PERIOD] });
// eth_call of a creation tx returns the runtime code (immutables filled in).
const { data: runtime } = await client.call({ data: initCode });

const subscriber = privateKeyToAccount(generatePrivateKey());
const head = await client.getBlock();
const t0 = Number(head.timestamp);

// FiatTokenV2_2 storage: balanceAndBlacklistStates @ slot 9, allowed @ slot 10.
const slotOf = (key, slot) => keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [key, slot]));
const balanceSlot = slotOf(subscriber.address, 9n);
const allowedInner = slotOf(subscriber.address, 10n); // allowed[owner]
const allowedSlot = keccak256(encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [PERMIT2, allowedInner]));

const stateOverrides = [
  { address: PLAN, code: runtime },
  {
    address: USDC,
    stateDiff: [
      { slot: balanceSlot, value: pad(toHex(10_000_000n), { size: 32 }) }, // 10 USDC
      { slot: allowedSlot, value: pad(toHex(maxUint256), { size: 32 }) }, // USDC.approve(Permit2, max)
    ],
  },
];

const permit = {
  details: { token: USDC, amount: AMOUNT * BigInt(PULLS), expiration: t0 + PERIOD * PULLS + 600, nonce: 0 },
  spender: PLAN,
  sigDeadline: BigInt(t0 + 1800),
};
const signature = await subscriber.signTypedData({
  domain: { name: "Permit2", chainId: baseSepolia.id, verifyingContract: PERMIT2 },
  types: PERMIT_TYPES,
  primaryType: "PermitSingle",
  message: permit,
});

const call = (to, abi_, functionName, args, from = RELAYER) => ({ to, from, data: encodeFunctionData({ abi: abi_, functionName, args }) });
const subscribeCall = call(PLAN, planAbi, "subscribe", [subscriber.address, permit, signature]);
const pullCall = call(PLAN, planAbi, "pull", [subscriber.address]);
const merchantBal = call(USDC, ERC20, "balanceOf", [MERCHANT]);
const allowanceCall = call(PERMIT2, PERMIT2_ABI, "allowance", [subscriber.address, USDC, PLAN]);

function explain(r) {
  if (r.status === "success") return "ok";
  try {
    const e = decodeErrorResult({ abi: [...planAbi, ...PERMIT2_ABI], data: r.data });
    return `revert ${e.errorName}(${e.args?.join(",") ?? ""})`;
  } catch {
    return `revert ${r.error?.message ?? r.data ?? "?"}`;
  }
}

let failures = 0;
function expect(label, cond, got) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : `  (got: ${got})`}`);
  if (!cond) failures++;
}
const bal = (r) => BigInt(r.data);

// ── scenario A: happy path across the full schedule ───────────────────────
{
  console.log("\nScenario A — subscribe, pull on schedule, cap at 4 pulls");
  const blocks = [
    // block 1 (t0+1): subscribe, pull #1 (due immediately), early pull #2 must fail
    { blockOverrides: { time: BigInt(t0 + 1) }, stateOverrides, calls: [subscribeCall, pullCall, pullCall, merchantBal, allowanceCall] },
    // blocks 2-4: one period later each
    ...[1, 2, 3].map((i) => ({ blockOverrides: { time: BigInt(t0 + 1 + i * PERIOD) }, calls: [pullCall, merchantBal] })),
    // block 5: 5th pull is due by time but the permit total is spent
    { blockOverrides: { time: BigInt(t0 + 1 + 4 * PERIOD) }, calls: [pullCall, merchantBal] },
  ];
  const res = await client.simulateBlocks({ blocks });
  const [b1, b2, b3, b4, b5] = res.map((b) => b.calls);

  expect("subscribe accepted by real Permit2 (signature + nonce valid)", b1[0].status === "success", explain(b1[0]));
  expect("pull #1 succeeds immediately", b1[1].status === "success", explain(b1[1]));
  expect("early pull #2 in the same period reverts NotDue", b1[2].status === "failure" && explain(b1[2]).includes("NotDue"), explain(b1[2]));
  expect("merchant received exactly one period (0.10 USDC)", bal(b1[3]) === AMOUNT, bal(b1[3]));
  expect("Permit2 allowance decremented to 0.30 USDC", BigInt(b1[4].data.slice(0, 66)) === AMOUNT * 3n, b1[4].data);
  expect("pull #2 succeeds one period later", b2[0].status === "success", explain(b2[0]));
  expect("pull #3 succeeds", b3[0].status === "success", explain(b3[0]));
  expect("pull #4 succeeds", b4[0].status === "success", explain(b4[0]));
  expect("merchant total after 4 pulls = 0.40 USDC", bal(b4[1]) === AMOUNT * 4n, bal(b4[1]));
  expect("5th pull reverts (permit total exhausted)", b5[0].status === "failure", explain(b5[0]));
  expect("merchant total unchanged = 0.40 USDC", bal(b5[1]) === AMOUNT * 4n, bal(b5[1]));
}

// ── scenario B: subscriber revokes on-chain ───────────────────────────────
{
  console.log("\nScenario B — subscriber revokes the allowance");
  const revoke = call(PERMIT2, PERMIT2_ABI, "approve", [USDC, PLAN, 0n, 0], subscriber.address);
  const res = await client.simulateBlocks({
    blocks: [
      { blockOverrides: { time: BigInt(t0 + 1) }, stateOverrides, calls: [subscribeCall, pullCall, revoke] },
      { blockOverrides: { time: BigInt(t0 + 1 + PERIOD) }, calls: [pullCall, merchantBal] },
    ],
  });
  const [b1, b2] = res.map((b) => b.calls);
  expect("first pull succeeds", b1[1].status === "success", explain(b1[1]));
  expect("revoke succeeds", b1[2].status === "success", explain(b1[2]));
  expect("pull after revoke reverts", b2[0].status === "failure", explain(b2[0]));
  expect("merchant keeps only the first 0.10 USDC", bal(b2[1]) === AMOUNT, bal(b2[1]));
}

// ── scenario C: forged / wrong inputs are rejected ────────────────────────
{
  console.log("\nScenario C — bad inputs");
  const other = privateKeyToAccount(generatePrivateKey());
  const forged = await other.signTypedData({
    domain: { name: "Permit2", chainId: baseSepolia.id, verifyingContract: PERMIT2 },
    types: PERMIT_TYPES,
    primaryType: "PermitSingle",
    message: permit,
  });
  const wrongSpender = { ...permit, spender: RELAYER };
  const wrongToken = { ...permit, details: { ...permit.details, token: MERCHANT } };
  const res = await client.simulateBlocks({
    blocks: [
      {
        blockOverrides: { time: BigInt(t0 + 1) },
        stateOverrides,
        calls: [
          call(PLAN, planAbi, "subscribe", [subscriber.address, permit, forged]), // signed by someone else
          call(PLAN, planAbi, "subscribe", [subscriber.address, wrongSpender, signature]),
          call(PLAN, planAbi, "subscribe", [subscriber.address, wrongToken, signature]),
          pullCall, // never subscribed
        ],
      },
    ],
  });
  const c = res[0].calls;
  expect("signature from a different wallet is rejected", c[0].status === "failure", explain(c[0]));
  expect("permit naming another spender is rejected (WrongSpender)", explain(c[1]).includes("WrongSpender"), explain(c[1]));
  expect("permit for another token is rejected (WrongToken)", explain(c[2]).includes("WrongToken"), explain(c[2]));
  expect("pull without a subscription reverts (NotSubscribed)", explain(c[3]).includes("NotSubscribed"), explain(c[3]));
}

// ── scenario D: open-ended (unlimited) permit ─────────────────────────────
{
  console.log("\nScenario D — open-ended permit (amount = 2^160-1, expiration = 2^48-1)");
  const MAX160 = 2n ** 160n - 1n;
  const MAX48 = 2 ** 48 - 1;
  const openPermit = {
    details: { token: USDC, amount: MAX160, expiration: MAX48, nonce: 0 },
    spender: PLAN,
    sigDeadline: BigInt(t0 + 1800),
  };
  const openSig = await subscriber.signTypedData({
    domain: { name: "Permit2", chainId: baseSepolia.id, verifyingContract: PERMIT2 },
    types: PERMIT_TYPES,
    primaryType: "PermitSingle",
    message: openPermit,
  });
  const PULLS_D = 8; // more than any finite plan above; fake wallet holds 10 USDC
  const blocks = [
    {
      blockOverrides: { time: BigInt(t0 + 1) },
      stateOverrides,
      calls: [call(PLAN, planAbi, "subscribe", [subscriber.address, openPermit, openSig]), pullCall, merchantBal, allowanceCall],
    },
    ...Array.from({ length: PULLS_D - 1 }, (_, i) => ({
      blockOverrides: { time: BigInt(t0 + 1 + (i + 1) * PERIOD) },
      calls: [pullCall],
    })),
    {
      blockOverrides: { time: BigInt(t0 + 1 + PULLS_D * PERIOD) },
      calls: [merchantBal, allowanceCall],
    },
  ];
  const res = await client.simulateBlocks({ blocks });
  const first = res[0].calls;
  const last = res[res.length - 1].calls;
  const allOk = res.slice(1, -1).every((b) => b.calls[0].status === "success");

  expect("unlimited permit accepted by Permit2", first[0].status === "success", explain(first[0]));
  expect("pull #1 succeeds", first[1].status === "success", explain(first[1]));
  expect(`pulls #2..#${PULLS_D} all succeed on schedule (past any finite cap)`, allOk, "see above");
  expect(`merchant received ${PULLS_D} × 0.10 USDC`, bal(last[0]) === AMOUNT * BigInt(PULLS_D), bal(last[0]));
  expect("allowance is NOT decremented (still unlimited)", BigInt(last[1].data.slice(0, 66)) === MAX160, last[1].data);
  console.log("      (Permit2 treats amount = 2^160-1 as unlimited — the contract still pays only 0.10 USDC per period.)");
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
