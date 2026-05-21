import { useState, useEffect } from "react";
import { parseUnits, formatUnits, createPublicClient, http } from "viem";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { base, mainnet, arbitrum, optimism, polygon } from "viem/chains";
import { ERC20_ABI, ERC4626_ABI } from "../ABIs";
import { createTxStatusMessage, formatErrorMessage } from "../utils";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/providers";

interface VaultInfo {
  address: string;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
}

function getViemChain(chainId: number) {
  switch (chainId) {
    case mainnet.id: return mainnet;
    case arbitrum.id: return arbitrum;
    case optimism.id: return optimism;
    case polygon.id: return polygon;
    default: return base;
  }
}

export function useVaultOperations(
  address: string | undefined,
  vaultInfo: VaultInfo | null,
  onSuccess?: () => void
) {
  const { chainId, evmAccount } = useWallet();
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [pendingDeposit, setPendingDeposit] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [assetBalance, setAssetBalance] = useState<bigint | undefined>();
  const [vaultBalance, setVaultBalance] = useState<bigint | undefined>();
  const [depositedAssets, setDepositedAssets] = useState<bigint | undefined>();
  const [allowance, setAllowance] = useState<bigint | undefined>();
  const queryClient = useQueryClient();

  const chain = getViemChain(chainId);
  const publicClient = createPublicClient({ chain, transport: http() });

  const getWalletClient = async () => {
    if (!evmAccount) return null;
    return createWalletClientForWalletAccount({ walletAccount: evmAccount });
  };

  const setSuccessStatus = (message: string) => {
    setTxStatus(message);
    setTimeout(() => setTxStatus(""), 4000);
    onSuccess?.();
  };

  const refetchData = () => {
    queryClient.invalidateQueries();
    refreshBalances();
  };

  const refreshBalances = async () => {
    if (!address || !vaultInfo) return;
    try {
      const [ab, vb, al] = await Promise.all([
        publicClient.readContract({
          address: vaultInfo.asset.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }),
        publicClient.readContract({
          address: vaultInfo.address as `0x${string}`,
          abi: ERC4626_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }),
        publicClient.readContract({
          address: vaultInfo.asset.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address as `0x${string}`, vaultInfo.address as `0x${string}`],
        }),
      ]);
      setAssetBalance(ab as bigint);
      setVaultBalance(vb as bigint);
      setAllowance(al as bigint);

      if ((vb as bigint) > 0n) {
        const da = await publicClient.readContract({
          address: vaultInfo.address as `0x${string}`,
          abi: ERC4626_ABI,
          functionName: "convertToAssets",
          args: [vb as bigint],
        });
        setDepositedAssets(da as bigint);
      } else {
        setDepositedAssets(0n);
      }
    } catch {}
  };

  useEffect(() => {
    if (!address || !vaultInfo) return;
    const client = createPublicClient({ chain: getViemChain(chainId), transport: http() });
    client.readContract({
      address: vaultInfo.asset.address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [address as `0x${string}`, vaultInfo.address as `0x${string}`],
    }).then((al) => setAllowance(al as bigint)).catch(() => {});
  }, [address, vaultInfo?.address, chainId]);

  const handleDepositAfterApproval = async () => {
    if (!vaultInfo?.address || !address) return;
    const walletClient = await getWalletClient();
    if (!walletClient) return;

    try {
      const { request } = await publicClient.simulateContract({
        address: vaultInfo.address as `0x${string}`,
        abi: ERC4626_ABI,
        functionName: "deposit",
        args: [parseUnits(amount, vaultInfo.asset.decimals), address as `0x${string}`],
        account: address as `0x${string}`,
      });
      await walletClient.writeContract(request);
      setPendingDeposit(false);
      setSuccessStatus(createTxStatusMessage("Deposit", true));
      refetchData();
    } catch (e: unknown) {
      setTxStatus(createTxStatusMessage("Deposit", false, formatErrorMessage(e)));
      setPendingDeposit(false);
    }
  };

  const handleApprove = async () => {
    if (!vaultInfo?.asset.address || !vaultInfo?.address) return;
    const walletClient = await getWalletClient();
    if (!walletClient || !address) return;

    setTxStatus("");
    setPendingDeposit(true);
    setIsApproving(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: vaultInfo.asset.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultInfo.address as `0x${string}`, parseUnits(amount, vaultInfo.asset.decimals)],
        account: address as `0x${string}`,
      });
      await walletClient.writeContract(request);
      setSuccessStatus(createTxStatusMessage("Approval", true));
      refetchData();
      setTimeout(() => {
        handleDepositAfterApproval();
      }, 1000);
    } catch (e: unknown) {
      setTxStatus(createTxStatusMessage("Approval", false, formatErrorMessage(e)));
      setPendingDeposit(false);
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    if (!vaultInfo?.address || !address) return;
    const walletClient = await getWalletClient();
    if (!walletClient) return;

    e.preventDefault();
    setTxStatus("");
    setIsDepositing(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: vaultInfo.address as `0x${string}`,
        abi: ERC4626_ABI,
        functionName: "deposit",
        args: [parseUnits(amount, vaultInfo.asset.decimals), address as `0x${string}`],
        account: address as `0x${string}`,
      });
      await walletClient.writeContract(request);
      setPendingDeposit(false);
      setSuccessStatus(createTxStatusMessage("Deposit", true));
      refetchData();
    } catch (e: unknown) {
      setTxStatus(createTxStatusMessage("Deposit", false, formatErrorMessage(e)));
      setPendingDeposit(false);
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    if (!vaultInfo?.address || !address) return;
    const walletClient = await getWalletClient();
    if (!walletClient) return;

    e.preventDefault();
    setTxStatus("");
    setIsWithdrawing(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: vaultInfo.address as `0x${string}`,
        abi: ERC4626_ABI,
        functionName: "withdraw",
        args: [
          parseUnits(amount, vaultInfo.asset.decimals),
          address as `0x${string}`,
          address as `0x${string}`,
        ],
        account: address as `0x${string}`,
      });
      await walletClient.writeContract(request);
      setSuccessStatus(createTxStatusMessage("Withdraw", true));
      refetchData();
    } catch (e: unknown) {
      setTxStatus(createTxStatusMessage("Withdraw", false, formatErrorMessage(e)));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const needsApproval =
    (allowance !== undefined &&
      vaultInfo?.asset.decimals !== undefined &&
      parseUnits(amount || "0", vaultInfo.asset.decimals) > allowance) ||
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
    approveError: null,
    depositError: null,
    withdrawError: null,
    handleApprove,
    handleDeposit,
    handleWithdraw,
    needsApproval,
  };
}
