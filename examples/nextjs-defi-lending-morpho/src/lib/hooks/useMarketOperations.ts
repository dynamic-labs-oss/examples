import { useState } from "react";
import { parseUnits, createPublicClient, http } from "viem";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { base, mainnet, arbitrum, optimism, polygon } from "viem/chains";
import { ERC20_ABI, MORPHO_MARKETS_ABI } from "../ABIs";
import { getContractsForChain } from "../constants";
import { useWallet } from "@/lib/providers";

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

function getViemChain(chainId: number) {
  switch (chainId) {
    case mainnet.id:
      return mainnet;
    case arbitrum.id:
      return arbitrum;
    case optimism.id:
      return optimism;
    case polygon.id:
      return polygon;
    default:
      return base;
  }
}

export function useMarketOperations(
  address: string | undefined,
  market: Market | null,
) {
  const { chainId, evmAccount } = useWallet();
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [loanTokenBalance, setLoanTokenBalance] = useState<
    bigint | undefined
  >();
  const [collateralBalance, setCollateralBalance] = useState<
    bigint | undefined
  >();
  const [loanTokenAllowance, setLoanTokenAllowance] = useState<
    bigint | undefined
  >();
  const [collateralAllowance, setCollateralAllowance] = useState<
    bigint | undefined
  >();
  const [isApprovingLoanToken, setIsApprovingLoanToken] = useState(false);
  const [isApprovingCollateral, setIsApprovingCollateral] = useState(false);
  const [isSupplying, setIsSupplying] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [isRepaying, setIsRepaying] = useState(false);

  const contracts = getContractsForChain(chainId);
  const chain = getViemChain(chainId);
  const publicClient = createPublicClient({ chain, transport: http() });

  const getWalletClient = async () => {
    if (!evmAccount) return null;
    return createWalletClientForWalletAccount({ walletAccount: evmAccount });
  };

  const refreshBalances = async () => {
    if (!address || !market) return;
    try {
      const [lb, cb, la, ca] = await Promise.all([
        publicClient.readContract({
          address: market.loanToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }),
        publicClient.readContract({
          address: market.collateralToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }),
        publicClient.readContract({
          address: market.loanToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [
            address as `0x${string}`,
            contracts.morphoMarkets as `0x${string}`,
          ],
        }),
        publicClient.readContract({
          address: market.collateralToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [
            address as `0x${string}`,
            contracts.morphoMarkets as `0x${string}`,
          ],
        }),
      ]);
      setLoanTokenBalance(lb as bigint);
      setCollateralBalance(cb as bigint);
      setLoanTokenAllowance(la as bigint);
      setCollateralAllowance(ca as bigint);
    } catch {}
  };

  const handleApproveLoanToken = async () => {
    if (!market?.loanToken.address) return;
    const walletClient = await getWalletClient();
    if (!walletClient || !address) return;

    setTxStatus("");
    setIsApprovingLoanToken(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: market.loanToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [
          contracts.morphoMarkets as `0x${string}`,
          parseUnits(amount, market.loanToken.decimals),
        ],
        account: address as `0x${string}`,
      });
      await walletClient.writeContract(request);
      setTxStatus("Loan token approval transaction sent!");
      await refreshBalances();
    } catch (e: unknown) {
      setTxStatus(
        "Loan token approval failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e)),
      );
    } finally {
      setIsApprovingLoanToken(false);
    }
  };

  const handleApproveCollateral = async () => {
    if (!market?.collateralToken.address) return;
    const walletClient = await getWalletClient();
    if (!walletClient || !address) return;

    setTxStatus("");
    setIsApprovingCollateral(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: market.collateralToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [
          contracts.morphoMarkets as `0x${string}`,
          parseUnits(amount, market.collateralToken.decimals),
        ],
        account: address as `0x${string}`,
      });
      await walletClient.writeContract(request);
      setTxStatus("Collateral approval transaction sent!");
      await refreshBalances();
    } catch (e: unknown) {
      setTxStatus(
        "Collateral approval failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e)),
      );
    } finally {
      setIsApprovingCollateral(false);
    }
  };

  const handleSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market?.collateralToken.address) return;
    const walletClient = await getWalletClient();
    if (!walletClient || !address) return;

    setTxStatus("");
    setIsSupplying(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "supply",
        args: [
          market.collateralToken.address as `0x${string}`,
          parseUnits(amount, market.collateralToken.decimals),
          address as `0x${string}`,
          BigInt(5),
        ],
        account: address as `0x${string}`,
      });
      await walletClient.writeContract(request);
      setTxStatus("Supply transaction sent!");
    } catch (e: unknown) {
      setTxStatus(
        "Supply failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e)),
      );
    } finally {
      setIsSupplying(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market?.collateralToken.address) return;
    const walletClient = await getWalletClient();
    if (!walletClient || !address) return;

    setTxStatus("");
    setIsWithdrawing(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "withdraw",
        args: [
          market.collateralToken.address as `0x${string}`,
          parseUnits(amount, market.collateralToken.decimals),
          address as `0x${string}`,
          address as `0x${string}`,
        ],
        account: address as `0x${string}`,
      });
      await walletClient.writeContract(request);
      setTxStatus("Withdraw transaction sent!");
    } catch (e: unknown) {
      setTxStatus(
        "Withdraw failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e)),
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market?.loanToken.address) return;
    const walletClient = await getWalletClient();
    if (!walletClient || !address) return;

    setTxStatus("");
    setIsBorrowing(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "borrow",
        args: [
          market.loanToken.address as `0x${string}`,
          parseUnits(amount, market.loanToken.decimals),
          address as `0x${string}`,
          BigInt(5),
        ],
        account: address as `0x${string}`,
      });
      await walletClient.writeContract(request);
      setTxStatus("Borrow transaction sent!");
    } catch (e: unknown) {
      setTxStatus(
        "Borrow failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e)),
      );
    } finally {
      setIsBorrowing(false);
    }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market?.loanToken.address) return;
    const walletClient = await getWalletClient();
    if (!walletClient || !address) return;

    setTxStatus("");
    setIsRepaying(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: contracts.morphoMarkets as `0x${string}`,
        abi: MORPHO_MARKETS_ABI,
        functionName: "repay",
        args: [
          market.loanToken.address as `0x${string}`,
          parseUnits(amount, market.loanToken.decimals),
          address as `0x${string}`,
        ],
        account: address as `0x${string}`,
      });
      await walletClient.writeContract(request);
      setTxStatus("Repay transaction sent!");
    } catch (e: unknown) {
      setTxStatus(
        "Repay failed: " +
          (e && typeof e === "object" && "message" in e
            ? (e as { message?: string }).message
            : String(e)),
      );
    } finally {
      setIsRepaying(false);
    }
  };

  const needsLoanTokenApproval =
    loanTokenAllowance !== undefined &&
    parseUnits(amount || "0", market?.loanToken.decimals || 18) >
      loanTokenAllowance;
  const needsCollateralApproval =
    collateralAllowance !== undefined &&
    parseUnits(amount || "0", market?.collateralToken.decimals || 6) >
      collateralAllowance;

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
    approveLoanTokenError: null,
    approveCollateralError: null,
    supplyError: null,
    withdrawError: null,
    borrowError: null,
    repayError: null,
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
