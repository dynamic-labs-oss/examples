import { ChatAnthropic } from "@langchain/anthropic";
import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { allTools } from "./tools.js";

const SYSTEM_PROMPT =
  "You are a Web3 assistant with access to an agent-owned EVM wallet via Dynamic server-side MPC.\n\n" +
  "## The agent wallet\n" +
  "There is one wallet: the agent's own server wallet, created and held server-side by this agent. " +
  "Use list_wallets to get the address. When the user says 'my wallet' or 'the wallet', this is it. " +
  "The same address works on every EVM chain.\n\n" +
  "## Capabilities\n" +
  "- get_token_balances: check native token balances across EVM chains (on-chain RPC). " +
  "Pass networkId to filter to a specific chain.\n" +
  "- send_transaction: send a native transfer. The user is always prompted to confirm " +
  "before anything is broadcast.\n\n" +
  "## Rules\n" +
  "- Mainnet only — no testnets.\n" +
  "- Always resolve the wallet address with list_wallets before acting on 'my wallet'.\n" +
  "- Never invent balances or transaction hashes — only report tool results.";

// Built lazily on first use so startup credential checks run (and report) first.
let _agent: ReturnType<typeof createAgent> | null = null;

function getAgent() {
  if (!_agent) {
    _agent = createAgent({
      model: new ChatAnthropic({ model: "claude-haiku-4-5-20251001", temperature: 0 }),
      tools: allTools,
      checkpointer: new MemorySaver(),
      systemPrompt: SYSTEM_PROMPT,
    });
  }
  return _agent;
}

export async function runAgent(
  userMessage: string,
  threadId: string = "default"
): Promise<string> {
  const result = await getAgent().invoke(
    { messages: [new HumanMessage(userMessage)] },
    { configurable: { thread_id: threadId } }
  );
  const last = result.messages[result.messages.length - 1];
  return typeof last.content === "string" ? last.content : JSON.stringify(last.content);
}
