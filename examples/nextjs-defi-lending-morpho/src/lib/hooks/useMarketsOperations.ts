import { useState } from "react";
import { parseUnits } from "viem";
import { useReadContract, useWriteContract, useChainId } from "wagmi";
import { ERC20_ABI, MORPHO_MARKETS_ABI } from "../ABIs";
import { getContractsForChain, getMarketParamsForChain } from "../constants";

export function useMarketsOperations(
  address: string | undefined,
  loanTokenDecimals: number = 18
) {
  const chainId = useChainId();
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState("");

  const contracts = getContractsForChain(chainId);
  const marketParams = getMarketParamsForChain(chainId);

  // Read loan token balance
  const { data: loanTokenBalance } = useReadContract({
    address: marketParams?.loanToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address && !!marketParams?.loanToken },
  });

  // Read collateral balance
  const { data: collateralBalance } = useReadContract({
    address: marketParams?.collateralToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address && !!marketParams?.collateralToken },
  });

  // Read allowances
  const { data: loanTokenAllowance } = useReadContract({
    address: marketParams?.loanToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      address && marketParams?.loanToken
        ? [address as `0x${string}`, contracts.morphoMarkets as `0x${string}`]
        : undefined,
    query: { enabled: !!address && !!marketParams?.loanToken },
  });

  const { data: collateralAllowance } = useReadContract({
    address: marketParams?.collateralToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      address && marketParams?.collateralToken
        ? [address as `0x${string}`, contracts.morphoMarkets as `0x${string}`]
        : undefined,
    query: { enabled: !!address && !!marketParams?.collateralToken },
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
    if (!marketParams?.loanToken) return;

    setTxStatus("");
    try {
      await writeApproveLoanToken({
        address: marketParams.loanToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [
          contracts.morphoMarkets as `0x${string}`,
          parseUnits(amount, loanTokenDecimals),
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
    if (!marketParams?.collateralToken) return;

    setTxStatus("");
    try {
      await writeApproveCollateral({
        address: marketParams.collateralToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [
          contracts.morphoMarkets as `0x${string}`,
          parseUnits(amount, 6), // Collateral decimals
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
    if (!marketParams?.collateralToken) return;

    setTxStatus("");
    try {
      await writeSupply({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "supply",
        args: [
          marketParams.collateralToken as `0x${string}`,
          parseUnits(amount, 6), // Collateral decimals
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
    if (!marketParams?.collateralToken) return;

    setTxStatus("");
    try {
      await writeWithdraw({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "withdraw",
        args: [
          marketParams.collateralToken as `0x${string}`,
          parseUnits(amount, 6), // Collateral decimals
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
    if (!marketParams?.loanToken) return;

    setTxStatus("");
    try {
      await writeBorrow({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "borrow",
        args: [
          marketParams.loanToken as `0x${string}`,
          parseUnits(amount, loanTokenDecimals),
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
    if (!marketParams?.loanToken) return;

    setTxStatus("");
    try {
      await writeRepay({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "repay",
        args: [
          marketParams.loanToken as `0x${string}`,
          parseUnits(amount, loanTokenDecimals),
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
    parseUnits(amount || "0", loanTokenDecimals) >
      (loanTokenAllowance as bigint);
  const needsCollateralApproval =
    collateralAllowance !== undefined &&
    parseUnits(amount || "0", 6) > (collateralAllowance as bigint); // Collateral decimals

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
