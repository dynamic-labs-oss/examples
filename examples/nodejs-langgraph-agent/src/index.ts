import "dotenv/config";
import readline from "node:readline";
import { initServerWallet } from "./wallet.js";
import { setAgentWallet } from "./tools.js";
import { runAgent } from "./agent.js";
import { setReadlineForConfirm } from "./confirm.js";

// ─── Initialize the agent's server wallet ────────────────────────────────────

const wallet = await initServerWallet();
setAgentWallet(wallet);

// ─── Interactive REPL ─────────────────────────────────────────────────────────

console.log("=".repeat(60));
console.log("  Dynamic + LangGraph bare-bones agent");
console.log("=".repeat(60));
console.log("Example commands:");
console.log('  "show my wallet"');
console.log('  "what are my token balances"');
console.log('  "send 0.001 ETH on ethereum to 0x..."');
console.log("  Type 'exit' to quit\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
setReadlineForConfirm(rl);

const threadId = "interactive-session";

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

rl.on("close", () => {
  console.log("\nGoodbye!");
  process.exit(0);
});

while (true) {
  const input = (await prompt("You: ")).trim();
  if (!input) continue;
  if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
    rl.close();
    break;
  }
  try {
    const response = await runAgent(input, threadId);
    console.log(`\nAgent: ${response}\n`);
  } catch (err: any) {
    console.error(`\nError: ${err?.message ?? String(err)}\n`);
  }
}
