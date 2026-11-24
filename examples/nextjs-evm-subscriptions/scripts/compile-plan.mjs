// Compiles contracts/SubscriptionPlan.sol with the pinned solc-js and returns
// { abi, bytecode }. Used by deploy-plan.mjs; run directly to just compile.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import solc from "solc";

const SOURCE = fileURLToPath(new URL("../contracts/SubscriptionPlan.sol", import.meta.url));

export function compilePlan() {
  const input = {
    language: "Solidity",
    sources: { "SubscriptionPlan.sol": { content: readFileSync(SOURCE, "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length) {
    throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  }
  for (const w of (out.errors ?? []).filter((e) => e.severity === "warning")) {
    console.warn(w.formattedMessage);
  }
  const c = out.contracts["SubscriptionPlan.sol"].SubscriptionPlan;
  return { abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { abi, bytecode } = compilePlan();
  console.log(`compiled OK — ${abi.length} ABI entries, ${(bytecode.length - 2) / 2} bytes of init code`);
}
