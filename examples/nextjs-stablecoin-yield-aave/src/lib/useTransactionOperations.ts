import { useSendTransaction } from "@aave/react/viem";
import { WalletClient, createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import {
  bigDecimal,
  chainId,
  evmAddress,
  useBorrow,
  useRepay,
  useSupply,
  useWithdraw,
} from "@aave/react";

export function useTransactionOperations(
  walletClient: WalletClient | null,
  selectedChainId: number
) {
  const [supply, supplying] = useSupply();
  const [borrow, borrowing] = useBorrow();
  const [repay, repaying] = useRepay();
  const [withdraw, withdrawing] = useWithdraw();
  const [sendTransaction, sending] = useSendTransaction(
    walletClient || undefined
  );

  const isOperating =
    supplying.loading ||
    borrowing.loading ||
    repaying.loading ||
    withdrawing.loading ||
    sending.loading;

  const operationError =
    supplying.error ||
    borrowing.error ||
    repaying.error ||
    withdrawing.error ||
    sending.error;

  const executeSupply = async (
    marketAddress: string,
    currencyAddress: string,
    amount: string
  ) => {
    if (!walletClient?.account?.address) {
      return;
    }

    // Check actual token balance on blockchain
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      // ERC20 balanceOf function
      const balanceOfAbi = parseAbiItem(
        "function balanceOf(address owner) view returns (uint256)"
      );
      await publicClient.readContract({
        address: currencyAddress as `0x${string}`,
        abi: [balanceOfAbi],
        functionName: "balanceOf",
        args: [walletClient.account.address as `0x${string}`],
      });

      // Try to get token decimals
      const decimalsAbi = parseAbiItem(
        "function decimals() view returns (uint8)"
      );
      try {
        await publicClient.readContract({
          address: currencyAddress as `0x${string}`,
          abi: [decimalsAbi],
          functionName: "decimals",
        });
        // Token balance check completed
      } catch {
        // Could not fetch token decimals
      }
    } catch {
      // Could not fetch token balance
    }

    try {
      const result = await supply({
        market: evmAddress(marketAddress),
        amount: {
          erc20: {
            currency: evmAddress(currencyAddress),
            value: bigDecimal(parseFloat(amount)),
          },
        },
        sender: evmAddress(walletClient.account.address),
        chainId: chainId(selectedChainId),
      }).andThen((plan) => {
        switch (plan.__typename) {
          case "TransactionRequest":
            return sendTransaction(plan);
          case "ApprovalRequired":
            return sendTransaction(plan.approval).andThen(() =>
              sendTransaction(plan.originalTransaction)
            );
          case "InsufficientBalanceError":
            throw new Error(
              `Insufficient balance: ${plan.required.value} required.`
            );
          default:
            throw new Error("Unknown transaction plan type");
        }
      });

      if (result.isErr()) {
        throw result.error;
      } else {
        return result.value;
      }
    } catch (error) {
      throw error;
    }
  };

  const executeBorrow = async (
    marketAddress: string,
    currencyAddress: string,
    amount: string
  ) => {
    if (!walletClient?.account?.address) {
      return;
    }

    try {
      const result = await borrow({
        market: evmAddress(marketAddress),
        amount: {
          erc20: {
            currency: evmAddress(currencyAddress),
            value: bigDecimal(parseFloat(amount)),
          },
        },
        sender: evmAddress(walletClient.account.address),
        chainId: chainId(selectedChainId),
      }).andThen((plan) => {
        switch (plan.__typename) {
          case "TransactionRequest":
            return sendTransaction(plan);
          case "ApprovalRequired":
            return sendTransaction(plan.approval).andThen(() =>
              sendTransaction(plan.originalTransaction)
            );
          case "InsufficientBalanceError":
            throw new Error(
              `Insufficient balance: ${plan.required.value} required.`
            );
          default:
            throw new Error("Unknown transaction plan type");
        }
      });

      if (result.isErr()) {
        throw result.error;
      } else {
        return result.value;
      }
    } catch (error) {
      throw error;
    }
  };

  const executeRepay = async (
    marketAddress: string,
    currencyAddress: string,
    amount: string | "max"
  ) => {
    if (!walletClient?.account?.address) {
      return;
    }

    try {
      const result = await repay({
        market: evmAddress(marketAddress),
        amount: {
          erc20: {
            currency: evmAddress(currencyAddress),
            value:
              amount === "max"
                ? { max: true }
                : { exact: bigDecimal(parseFloat(amount)) },
          },
        },
        sender: evmAddress(walletClient.account.address),
        chainId: chainId(selectedChainId),
      }).andThen((plan) => {
        switch (plan.__typename) {
          case "TransactionRequest":
            return sendTransaction(plan);
          case "ApprovalRequired":
            return sendTransaction(plan.approval).andThen(() =>
              sendTransaction(plan.originalTransaction)
            );
          case "InsufficientBalanceError":
            throw new Error(
              `Insufficient balance: ${plan.required.value} required.`
            );
          default:
            throw new Error("Unknown transaction plan type");
        }
      });

      if (result.isErr()) {
        throw result.error;
      } else {
        return result.value;
      }
    } catch (error) {
      throw error;
    }
  };

  const executeWithdraw = async (
    marketAddress: string,
    currencyAddress: string,
    amount: string | "max"
  ) => {
    if (!walletClient?.account?.address) {
      return;
    }

    try {
      const result = await withdraw({
        market: evmAddress(marketAddress),
        amount: {
          erc20: {
            currency: evmAddress(currencyAddress),
            value:
              amount === "max"
                ? { max: true }
                : { exact: bigDecimal(parseFloat(amount)) },
          },
        },
        sender: evmAddress(walletClient.account.address),
        chainId: chainId(selectedChainId),
      }).andThen((plan) => {
        switch (plan.__typename) {
          case "TransactionRequest":
            return sendTransaction(plan);
          case "ApprovalRequired":
            return sendTransaction(plan.approval).andThen(() =>
              sendTransaction(plan.originalTransaction)
            );
          case "InsufficientBalanceError":
            throw new Error(
              `Insufficient balance: ${plan.required.value} required.`
            );
          default:
            throw new Error("Unknown transaction plan type");
        }
      });

      if (result.isErr()) {
        throw result.error;
      } else {
        return result.value;
      }
    } catch (error) {
      throw error;
    }
  };

  return {
    isOperating,
    operationError,
    executeSupply,
    executeBorrow,
    executeRepay,
    executeWithdraw,
  };
}
