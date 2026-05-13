import { useSendTransaction } from "@aave/react/viem";
import { WalletClient } from "viem";
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
    if (!walletClient?.account?.address) return;

    const result = await supply({
      market: evmAddress(marketAddress),
      amount: {
        erc20: {
          currency: evmAddress(currencyAddress),
          value: bigDecimal(Number.parseFloat(amount)),
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
          throw new Error(`Insufficient balance: ${plan.required.value} required.`);
        default:
          throw new Error("Unknown transaction plan type");
      }
    });

    if (result.isErr()) throw result.error;
    return result.value;
  };

  const executeBorrow = async (
    marketAddress: string,
    currencyAddress: string,
    amount: string
  ) => {
    if (!walletClient?.account?.address) return;

    const result = await borrow({
      market: evmAddress(marketAddress),
      amount: {
        erc20: {
          currency: evmAddress(currencyAddress),
          value: bigDecimal(Number.parseFloat(amount)),
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
          throw new Error(`Insufficient balance: ${plan.required.value} required.`);
        default:
          throw new Error("Unknown transaction plan type");
      }
    });

    if (result.isErr()) throw result.error;
    return result.value;
  };

  const executeRepay = async (
    marketAddress: string,
    currencyAddress: string,
    amount: string
  ) => {
    if (!walletClient?.account?.address) return;

    const result = await repay({
      market: evmAddress(marketAddress),
      amount: {
        erc20: {
          currency: evmAddress(currencyAddress),
          value:
            amount === "max"
              ? { max: true }
              : { exact: bigDecimal(Number.parseFloat(amount)) },
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
          throw new Error(`Insufficient balance: ${plan.required.value} required.`);
        default:
          throw new Error("Unknown transaction plan type");
      }
    });

    if (result.isErr()) throw result.error;
    return result.value;
  };

  const executeWithdraw = async (
    marketAddress: string,
    currencyAddress: string,
    amount: string
  ) => {
    if (!walletClient?.account?.address) return;

    const result = await withdraw({
      market: evmAddress(marketAddress),
      amount: {
        erc20: {
          currency: evmAddress(currencyAddress),
          value:
            amount === "max"
              ? { max: true }
              : { exact: bigDecimal(Number.parseFloat(amount)) },
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
          throw new Error(`Insufficient balance: ${plan.required.value} required.`);
        default:
          throw new Error("Unknown transaction plan type");
      }
    });

    if (result.isErr()) throw result.error;
    return result.value;
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
