import AgentFundingFlow from "@/components/flow/agent-funding-flow";

/**
 * Single-screen demo: sign in → an account is created → authorize your agent →
 * add funds. Everything is framed in USD; the words "crypto", "wallet", and
 * "blockchain" never appear in the UI. Behind the scenes it's a Dynamic embedded
 * MPC wallet with delegated access, funded with USDC, that an agent spends via x402.
 */
export default function Home() {
  return (
    <main className="w-full max-w-md">
      <AgentFundingFlow />
    </main>
  );
}
