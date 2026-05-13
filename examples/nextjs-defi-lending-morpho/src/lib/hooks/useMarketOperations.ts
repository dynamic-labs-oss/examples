import { useState } from "react";
import { parseUnits } from "viem";
import { useReadContract, useWriteContract, useChainId } from "wagmi";
import { ERC20_ABI, MORPHO_MARKETS_ABI } from "../ABIs";
import { getContractsForChain } from "../constants";

interface Market {
  loanToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
  collateralToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
}

export function useMarketOperations(
  address: string | undefined,
  market: Market | null
) {
  const chainId = useChainId();
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState("");

  const contracts = getContractsForChain(chainId);

  // Read loan token balance
  const { data: loanTokenBalance } = useReadContract({
    address: market?.loanToken.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address && !!market?.loanToken.address },
  });

  // Read collateral balance
  const { data: collateralBalance } = useReadContract({
    address: market?.collateralToken.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address && !!market?.collateralToken.address },
  });

  // Read allowances
  const { data: loanTokenAllowance } = useReadContract({
    address: market?.loanToken.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      address && market?.loanToken.address
        ? [address as `0x${string}`, contracts.morphoMarkets as `0x${string}`]
        : undefined,
    query: { enabled: !!address && !!market?.loanToken.address },
  });

  const { data: collateralAllowance } = useReadContract({
    address: market?.collateralToken.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      address && market?.collateralToken.address
        ? [address as `0x${string}`, contracts.morphoMarkets as `0x${string}`]
        : undefined,
    query: { enabled: !!address && !!market?.collateralToken.address },
  });

  // Write contracts
  const {
    writeContract: writeApproveLoanToken,
    isPending: isApprovingLoanToken,
    error: approveLoanTokenError,
  } = useWriteContract();
  const {
    writeContract: writeApproveCollateral,
    isPending: isApprovingCollateral,
    error: approveCollateralError,
  } = useWriteContract();
  const {
    writeContract: writeSupply,
    isPending: isSupplying,
    error: supplyError,
  } = useWriteContract();
  const {
    writeContract: writeWithdraw,
    isPending: isWithdrawing,
    error: withdrawError,
  } = useWriteContract();
  const {
    writeContract: writeBorrow,
    isPending: isBorrowing,
    error: borrowError,
  } = useWriteContract();
  const {
    writeContract: writeRepay,
    isPending: isRepaying,
    error: repayError,
  } = useWriteContract();

  // Approve functions
  const handleApproveLoanToken = async () => {
    if (!market?.loanToken.address) return;

    setTxStatus("");
    try {
      await writeApproveLoanToken({
        address: market.loanToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [
          contracts.morphoMarkets as `0x${string}`,
          parseUnits(amount, market.loanToken.decimals),
        ],
      });
      setTxStatus("Loan token approval transaction sent!");
    } catch (e: unknown) {
      setTxStatus(
        "Loan token approval failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e))
      );
    }
  };

  const handleApproveCollateral = async () => {
    if (!market?.collateralToken.address) return;

    setTxStatus("");
    try {
      await writeApproveCollateral({
        address: market.collateralToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [
          contracts.morphoMarkets as `0x${string}`,
          parseUnits(amount, market.collateralToken.decimals),
        ],
      });
      setTxStatus("Collateral approval transaction sent!");
    } catch (e: unknown) {
      setTxStatus(
        "Collateral approval failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e))
      );
    }
  };

  // Market operations
  const handleSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market?.collateralToken.address) return;

    setTxStatus("");
    try {
      await writeSupply({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "supply",
        args: [
          market.collateralToken.address as `0x${string}`,
          parseUnits(amount, market.collateralToken.decimals),
          address as `0x${string}`,
          BigInt(5), // maxIterations
        ],
      });
      setTxStatus("Supply transaction sent!");
    } catch (e: unknown) {
      setTxStatus(
        "Supply failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e))
      );
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market?.collateralToken.address) return;

    setTxStatus("");
    try {
      await writeWithdraw({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "withdraw",
        args: [
          market.collateralToken.address as `0x${string}`,
          parseUnits(amount, market.collateralToken.decimals),
          address as `0x${string}`,
          address as `0x${string}`,
        ],
      });
      setTxStatus("Withdraw transaction sent!");
    } catch (e: unknown) {
      setTxStatus(
        "Withdraw failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e))
      );
    }
  };

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market?.loanToken.address) return;

    setTxStatus("");
    try {
      await writeBorrow({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "borrow",
        args: [
          market.loanToken.address as `0x${string}`,
          parseUnits(amount, market.loanToken.decimals),
          address as `0x${string}`,
          BigInt(5), // maxIterations
        ],
      });
      setTxStatus("Borrow transaction sent!");
    } catch (e: unknown) {
      setTxStatus(
        "Borrow failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e))
      );
    }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market?.loanToken.address) return;

    setTxStatus("");
    try {
      await writeRepay({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "repay",
        args: [
          market.loanToken.address as `0x${string}`,
          parseUnits(amount, market.loanToken.decimals),
          address as `0x${string}`,
        ],
      });
      setTxStatus("Repay transaction sent!");
    } catch (e: unknown) {
      setTxStatus(
        "Repay failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e))
      );
    }
  };

  // Check if approvals are needed
  const needsLoanTokenApproval =
    loanTokenAllowance !== undefined &&
    parseUnits(amount || "0", market?.loanToken.decimals || 18) >
      (loanTokenAllowance as bigint);
  const needsCollateralApproval =
    collateralAllowance !== undefined &&
    parseUnits(amount || "0", market?.collateralToken.decimals || 6) >
      (collateralAllowance as bigint);

  return {
    amount,
    setAmount,
    txStatus,
    setTxStatus,
    loanTokenBalance,
    collateralBalance,
    loanTokenAllowance,
    collateralAllowance,
    isApprovingLoanToken,
    isApprovingCollateral,
    isSupplying,
    isWithdrawing,
    isBorrowing,
    isRepaying,
    approveLoanTokenError,
    approveCollateralError,
    supplyError,
    withdrawError,
    borrowError,
    repayError,
    handleApproveLoanToken,
    handleApproveCollateral,
    handleSupply,
    handleWithdraw,
    handleBorrow,
    handleRepay,
    needsLoanTokenApproval,
    needsCollateralApproval,
  };
}
