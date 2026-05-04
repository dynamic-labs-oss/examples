import { useState, useCallback } from "react";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { base, mainnet, polygon } from "viem/chains";
import { client as podsClient } from "./pods";
import type { Strategy, TransactionCall } from "./pods-types";
import { useWallet } from "@/lib/providers";

function getViemChain(chainId: number) {
  switch (chainId) {
    case mainnet.id: return mainnet;
    case polygon.id: return polygon;
    default: return base;
  }
}

export function useTransactionOperations(
  _walletClient: unknown,
  selectedChainId: number
) {
  const { evmAccount } = useWallet();
  const [isOperating, setIsOperating] = useState(false);
  const [operationError, setOperationError] = useState<Error | null>(null);

  const executeDeposit = useCallback(async (strategy: Strategy, amount: string) => {
    const walletAddress = evmAccount?.address;
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }

    setIsOperating(true);
    setOperationError(null);

    try {
      const decimals = strategy.assetDecimals;
      const amountInSmallestUnit = BigInt(
        Math.floor(parseFloat(amount) * 10 ** decimals)
      ).toString();

      const { bytecode } = await podsClient.getDepositBytecode({
        strategyId: strategy.id,
        chainId: selectedChainId,
        amount: amountInSmallestUnit,
        asset: strategy.assetName,
        wallet: walletAddress,
      });

      if (!evmAccount) throw new Error("Wallet account unavailable");
      const chain = getViemChain(selectedChainId);
      const walletClient = createWalletClientForWalletAccount({ walletAccount: evmAccount, chain });

      let lastHash: string | undefined;
      for (const tx of bytecode) {
        const hash = await walletClient.sendTransaction({
          chain,
          account: evmAccount.address as `0x${string}`,
          to: tx.to as `0x${string}`,
          value: BigInt(tx.value),
          data: tx.data as `0x${string}`,
        });
        lastHash = hash;
      }
      return lastHash!;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setOperationError(err);
      throw err;
    } finally {
      setIsOperating(false);
    }
  }, [evmAccount, selectedChainId]);

  const executeWithdraw = useCallback(async (strategy: Strategy, amount: string) => {
    const walletAddress = evmAccount?.address;
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }

    setIsOperating(true);
    setOperationError(null);

    try {
      const decimals = strategy.assetDecimals;
      const amountInSmallestUnit = BigInt(
        Math.floor(parseFloat(amount) * 10 ** decimals)
      ).toString();

      const { bytecode } = await podsClient.getWithdrawBytecode({
        strategyId: strategy.id,
        chainId: selectedChainId,
        amount: amountInSmallestUnit,
        asset: strategy.assetName,
        wallet: walletAddress,
      });

      if (!evmAccount) throw new Error("Wallet account unavailable");
      const chain = getViemChain(selectedChainId);
      const walletClient = createWalletClientForWalletAccount({ walletAccount: evmAccount, chain });

      let lastHash: string | undefined;
      for (const tx of bytecode) {
        const hash = await walletClient.sendTransaction({
          chain,
          account: evmAccount.address as `0x${string}`,
          to: tx.to as `0x${string}`,
          value: BigInt(tx.value),
          data: tx.data as `0x${string}`,
        });
        lastHash = hash;
      }
      return lastHash!;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setOperationError(err);
      throw err;
    } finally {
      setIsOperating(false);
    }
  }, [evmAccount, selectedChainId]);

  return {
    isOperating,
    operationError,
    executeDeposit,
    executeWithdraw,
  };
}
