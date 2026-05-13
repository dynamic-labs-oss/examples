import { useState } from "react";
import { parseUnits } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import { ERC20_ABI, ERC4626_ABI } from "../ABIs";
import { createTxStatusMessage, formatErrorMessage } from "../utils";
import { useQueryClient } from "@tanstack/react-query";

interface VaultInfo {
  address: string;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
}

export function useVaultOperations(
  address: string | undefined,
  vaultInfo: VaultInfo | null
) {
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [pendingDeposit, setPendingDeposit] = useState(false);
  const queryClient = useQueryClient();

  // Function to refetch all relevant data after transaction success
  const refetchData = () => {
    // Invalidate all queries to trigger refetch
    queryClient.invalidateQueries();
  };

  // Read asset balance
  const { data: assetBalance } = useReadContract({
    address: vaultInfo?.asset.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!vaultInfo?.asset.address },
  });

  // Read vault share balance
  const { data: vaultBalance } = useReadContract({
    address: vaultInfo?.address as `0x${string}`,
    abi: ERC4626_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!vaultInfo?.address },
  });

  // Read user's deposited assets (convert shares to assets)
  const { data: depositedAssets } = useReadContract({
    address: vaultInfo?.address as `0x${string}`,
    abi: ERC4626_ABI,
    functionName: "convertToAssets",
    args: vaultBalance ? [vaultBalance] : undefined,
    query: { enabled: !!vaultInfo?.address && !!vaultBalance },
  });

  // Read allowance
  const { data: allowance } = useReadContract({
    address: vaultInfo?.asset.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      address && vaultInfo?.asset.address && vaultInfo?.address
        ? [address, vaultInfo.address]
        : undefined,
    query: {
      enabled: !!address && !!vaultInfo?.asset.address && !!vaultInfo?.address,
    },
  });

  // Approve asset
  const {
    writeContract: writeApprove,
    isPending: isApproving,
    error: approveError,
  } = useWriteContract({
    mutation: {
      onSuccess: () => {
        setTxStatus(createTxStatusMessage("Approval", true));
        refetchData();

        // If there's a pending deposit, automatically trigger it
        if (pendingDeposit && vaultInfo && address) {
          setTimeout(() => {
            handleDepositAfterApproval();
          }, 1000); // Small delay to ensure approval is processed
        }
      },
      onError: (error) => {
        setTxStatus(
          createTxStatusMessage("Approval", false, formatErrorMessage(error))
        );
        setPendingDeposit(false);
      },
    },
  });

  // Deposit
  const {
    writeContract: writeDeposit,
    isPending: isDepositing,
    error: depositError,
  } = useWriteContract({
    mutation: {
      onSuccess: () => {
        setTxStatus(createTxStatusMessage("Deposit", true));
        refetchData();
        setPendingDeposit(false);
      },
      onError: (error) => {
        setTxStatus(
          createTxStatusMessage("Deposit", false, formatErrorMessage(error))
        );
        setPendingDeposit(false);
      },
    },
  });

  // Withdraw
  const {
    writeContract: writeWithdraw,
    isPending: isWithdrawing,
    error: withdrawError,
  } = useWriteContract({
    mutation: {
      onSuccess: () => {
        setTxStatus(createTxStatusMessage("Withdraw", true));
        refetchData();
      },
      onError: (error) => {
        setTxStatus(
          createTxStatusMessage("Withdraw", false, formatErrorMessage(error))
        );
      },
    },
  });

  const handleDepositAfterApproval = async () => {
    if (!vaultInfo?.address || !address) return;

    try {
      await writeDeposit({
        address: vaultInfo.address as `0x${string}`,
        abi: ERC4626_ABI,
        functionName: "deposit",
        args: [parseUnits(amount, vaultInfo.asset.decimals), address],
      });
    } catch (e: unknown) {
      setTxStatus(
        createTxStatusMessage("Deposit", false, formatErrorMessage(e))
      );
      setPendingDeposit(false);
    }
  };

  const handleApprove = async () => {
    if (!vaultInfo?.asset.address || !vaultInfo?.address) return;

    setTxStatus("");
    setPendingDeposit(true); // Mark that we want to deposit after approval
    try {
      await writeApprove({
        address: vaultInfo.asset.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultInfo.address, parseUnits(amount, vaultInfo.asset.decimals)],
      });
    } catch (e: unknown) {
      setTxStatus(
        createTxStatusMessage("Approval", false, formatErrorMessage(e))
      );
      setPendingDeposit(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    if (!vaultInfo?.address || !address) return;

    e.preventDefault();
    setTxStatus("");
    try {
      await writeDeposit({
        address: vaultInfo.address as `0x${string}`,
        abi: ERC4626_ABI,
        functionName: "deposit",
        args: [parseUnits(amount, vaultInfo.asset.decimals), address],
      });
    } catch (e: unknown) {
      setTxStatus(
        createTxStatusMessage("Deposit", false, formatErrorMessage(e))
      );
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    if (!vaultInfo?.address || !address) return;

    e.preventDefault();
    setTxStatus("");
    try {
      await writeWithdraw({
        address: vaultInfo.address as `0x${string}`,
        abi: ERC4626_ABI,
        functionName: "withdraw",
        args: [parseUnits(amount, vaultInfo.asset.decimals), address, address],
      });
    } catch (e: unknown) {
      setTxStatus(
        createTxStatusMessage("Withdraw", false, formatErrorMessage(e))
      );
    }
  };

  const needsApproval =
    (allowance !== undefined &&
      vaultInfo?.asset.decimals &&
      parseUnits(amount || "0", vaultInfo.asset.decimals) >
        (allowance as bigint)) ||
    false;

  return {
    amount,
    setAmount,
    txStatus,
    setTxStatus,
    pendingDeposit,
    assetBalance,
    vaultBalance,
    depositedAssets,
    allowance,
    isApproving,
    isDepositing,
    isWithdrawing,
    approveError,
    depositError,
    withdrawError,
    handleApprove,
    handleDeposit,
    handleWithdraw,
    needsApproval,
  };
}
