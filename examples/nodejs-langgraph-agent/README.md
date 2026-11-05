# Bare-bones LangGraph agent + Dynamic server wallet

A minimal [LangGraph](https://github.com/langchain-ai/langgraphjs) ReAct agent
that acts through its own **Dynamic server-side MPC wallet**. The agent creates
and owns its wallet entirely server-side — no user JWT, no delegation, no
client-side approval flow required.

It ships three tools:

| Tool | What it does |
| --- | --- |
| `list_wallets` | Returns the agent's server wallet address. |
| `get_token_balances` | Native-token balances across EVM chains via on-chain RPC. |
| `send_transaction` | Native transfer, signed via Dynamic server-side MPC. **Always** gated behind a `y/N` confirm prompt. |

## How it works

```
You ──▶ LangGraph ReAct agent (Claude) ──▶ tools ──▶ Dynamic MPC signing ──▶ chain
```

- **`src/wallet.ts`** — initializes the `DynamicEvmWalletClient`, creates a new
  wallet on first run (persisted to `.wallet-state.json`), and signs + broadcasts
  transactions.
- **`src/tools.ts`** — the three LangChain tools above.
- **`src/agent.ts`** — the `createReactAgent` loop (Claude Haiku 4.5) + system prompt.
- **`src/index.ts`** — an interactive terminal REPL.
- **`src/confirm.ts`** — the confirmation prompt for sensitive actions.

## Setup

1. Install dependencies (this repo uses pnpm):

   ```bash
   pnpm install
   ```

2. Create your env file from the example and fill it in:

   ```bash
   cp .example.env .env
   ```

   | Variable | Purpose |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | Drives the agent. |
   | `DYNAMIC_ENVIRONMENT_ID`, `DYNAMIC_API_KEY` | Dynamic env for server-side MPC signing. |

3. Run it:

   ```bash
   pnpm start        # or: pnpm dev  (watch mode)
   ```

   On first run the agent creates an MPC wallet and saves it to `.wallet-state.json`.
   Subsequent runs reuse the same wallet.

   ```
   You: show my wallet
   Agent: Your server wallet is 0x1234…abcd.

   You: send 0.001 ETH on ethereum to 0xabc…
   ┌─ ACTION REQUIRED ────────────────────────────────────────
   │  Send native transfer
   │    Chain:  Ethereum (1)
   │    To:     0xabc…
   │    Amount: 0.001 ETH
   └──────────────────────────────────────────────────────────
   Proceed? [y/N]
   ```

## Notes

- **Mainnet only.** Supported chains: Ethereum (1), Polygon (137), Base (8453),
  Arbitrum (42161), Optimism (10), BSC (56). Extend `CHAIN_MAP` in `src/wallet.ts`.
- `.wallet-state.json` contains the server key share — treat it like a private key.
  It is gitignored; never commit it or expose it to untrusted parties.
- `send_transaction` only does native transfers. To add ERC-20 transfers or contract
  calls, build the calldata and extend `sendTransactionServer`.
- Conversation memory is in-process (`MemorySaver`) and resets on restart.
