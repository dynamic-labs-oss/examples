import { useState } from "react";
import { useWriteContract, useChainId } from "wagmi";
import { getContractsForChain } from "../constants";
import { REWARDS_ABI } from "../ABIs";

export function useRewardsOperations(vaultAddress?: string) {
  const chainId = useChainId();
  const [claimTxStatus, setClaimTxStatus] = useState("");

  const contracts = getContractsForChain(chainId);

  // Claim rewards
  const {
    writeContract: writeClaimReward,
    isPending: isClaiming,
    error: claimError,
  } = useWriteContract();

  const handleClaimReward = async () => {
    if (!vaultAddress) return;

    setClaimTxStatus("");
    try {
      await writeClaimReward({
        address: contracts.rewardsDistributor as `0x${string}`,
        abi: REWARDS_ABI,
        functionName: "claimReward",
        args: [vaultAddress as `0x${string}`],
      });
      setClaimTxStatus("Reward claim transaction sent!");
    } catch (e: unknown) {
      setClaimTxStatus(
        "Claim failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e))
      );
    }
  };

  return {
    claimTxStatus,
    setClaimTxStatus,
    isClaiming,
    claimError,
    handleClaimReward,
  };
}
