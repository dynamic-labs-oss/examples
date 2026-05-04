import { useState } from "react";
import { createPublicClient, http } from "viem";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { base, mainnet, arbitrum, optimism, polygon } from "viem/chains";
import { getContractsForChain } from "../constants";
import { REWARDS_ABI } from "../ABIs";
import { useWallet } from "@/lib/providers";

function getViemChain(chainId: number) {
  switch (chainId) {
    case mainnet.id: return mainnet;
    case arbitrum.id: return arbitrum;
    case optimism.id: return optimism;
    case polygon.id: return polygon;
    default: return base;
  }
}

export function useRewardsOperations(vaultAddress?: string) {
  const { chainId, evmAccount } = useWallet();
  const [claimTxStatus, setClaimTxStatus] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);

  const contracts = getContractsForChain(chainId);
  const chain = getViemChain(chainId);
  const publicClient = createPublicClient({ chain, transport: http() });

  const handleClaimReward = async () => {
    if (!vaultAddress || !evmAccount) return;
    const walletClient = createWalletClientForWalletAccount({ walletAccount: evmAccount, chain });

    setClaimTxStatus("");
    setIsClaiming(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: contracts.rewardsDistributor as `0x${string}`,
        abi: REWARDS_ABI,
        functionName: "claimReward",
        args: [vaultAddress as `0x${string}`],
        account: evmAccount.address as `0x${string}`,
      });
      await walletClient.writeContract(request);
      setClaimTxStatus("Reward claim transaction sent!");
    } catch (e: unknown) {
      setClaimTxStatus(
        "Claim failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e))
      );
    } finally {
      setIsClaiming(false);
    }
  };

  return {
    claimTxStatus,
    setClaimTxStatus,
    isClaiming,
    claimError: null,
    handleClaimReward,
  };
}
