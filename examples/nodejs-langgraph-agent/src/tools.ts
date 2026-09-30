import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { isAddress, parseEther, formatEther, createPublicClient, http } from "viem";
import { confirm } from "./confirm.js";
import {
  getChainById,
  sendTransactionServer,
  SUPPORTED_CHAIN_IDS,
  type ServerWallet,
} from "./wallet.js";

// ─── Agent wallet (set once at startup) ──────────────────────────────────────

let agentWallet: ServerWallet | null = null;

export function setAgentWallet(wallet: ServerWallet): void {
  agentWallet = wallet;
  console.log(`[agent-wallet] Loaded server wallet: ${wallet.accountAddress}`);
}

function requireWallet(): ServerWallet {
  if (!agentWallet) {
    throw new Error("No agent wallet loaded. Run initServerWallet() at startup.");
  }
  return agentWallet;
}

function toolError(err: unknown): string {
  return JSON.stringify({
    success: false,
    error: err instanceof Error ? err.message : String(err),
  });
}

// ─── list_wallets ─────────────────────────────────────────────────────────────

export const listWalletsTool = tool(
  async () => {
    if (!agentWallet) {
      return JSON.stringify({ wallets: [], message: "No agent wallet loaded" });
    }
    return JSON.stringify({
      wallets: [
        {
          label: "agent",
          address: agentWallet.accountAddress,
          type: "server (agent-owned MPC wallet)",
        },
      ],
    });
  },
  {
    name: "list_wallets",
    description: "Show the agent's server wallet address.",
    schema: z.object({}),
  }
);

// ─── get_token_balances (on-chain via viem) ───────────────────────────────────

export const getTokenBalancesTool = tool(
  async ({ networkId }) => {
    try {
      const wallet = requireWallet();
      const address = wallet.accountAddress as `0x${string}`;

      const chainIds = networkId ? [networkId] : SUPPORTED_CHAIN_IDS;

      const fetchBalance = async (chainId: number) => {
        try {
          const chain = getChainById(chainId);
          const client = createPublicClient({ chain, transport: http() });
          const balance = await client.getBalance({ address });
          return {
            networkId: chainId,
            chainName: chain.name,
            symbol: chain.nativeCurrency.symbol,
            balance: formatEther(balance),
            isNative: true,
          };
        } catch {
          return null;
        }
      };

      const results = (await Promise.all(chainIds.map(fetchBalance))).filter(
        Boolean
      );

      return JSON.stringify({
        success: true,
        address,
        tokens: results,
      });
    } catch (err) {
      return toolError(err);
    }
  },
  {
    name: "get_token_balances",
    description:
      "Get native token balances for the agent's server wallet across EVM chains. " +
      "Use networkId to filter to a specific chain (e.g. 1 = Ethereum, 137 = Polygon, " +
      "8453 = Base). Balances are fetched on-chain via RPC.",
    schema: z.object({
      networkId: z
        .number()
        .optional()
        .describe(
          "Specific network ID (1 = Ethereum, 137 = Polygon, 8453 = Base). " +
            "Omit to query all supported chains."
        ),
    }),
  }
);

// ─── send_transaction ─────────────────────────────────────────────────────────

export const sendTransactionTool = tool(
  async ({ to, amountEth, chainId }) => {
    try {
      const wallet = requireWallet();
      if (!isAddress(to)) {
        return toolError(new Error(`"${to}" is not a valid EVM address`));
      }

      const value = parseEther(amountEth);
      const chain = getChainById(chainId);

      const ok = await confirm(
        `Send native transfer\n` +
          `  Chain:  ${chain.name} (${chainId})\n` +
          `  From:   ${wallet.accountAddress}\n` +
          `  To:     ${to}\n` +
          `  Amount: ${formatEther(value)} ${chain.nativeCurrency.symbol}`
      );
      if (!ok) {
        return JSON.stringify({ success: false, error: "User declined the transaction" });
      }

      const hash = await sendTransactionServer(
        wallet,
        chainId,
        to as `0x${string}`,
        value
      );
      return JSON.stringify({ success: true, transactionHash: hash, chainId });
    } catch (err) {
      return toolError(err);
    }
  },
  {
    name: "send_transaction",
    description:
      "Send a native-currency transfer (e.g. ETH, POL) from the agent's server wallet. " +
      "Signs via Dynamic MPC and broadcasts. The user is always prompted to confirm before " +
      "the transaction is sent.",
    schema: z.object({
      to: z.string().describe("Recipient EVM address (0x...)"),
      amountEth: z
        .string()
        .describe('Amount to send, in whole native units (e.g. "0.01")'),
      chainId: z
        .number()
        .describe("EVM chain ID (1 = Ethereum, 137 = Polygon, 8453 = Base)"),
    }),
  }
);

export const allTools = [listWalletsTool, getTokenBalancesTool, sendTransactionTool];
