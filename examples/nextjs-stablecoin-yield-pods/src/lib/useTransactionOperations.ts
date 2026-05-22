import { useState, useCallback } from "react";
// TODO: install @dynamic-labs/viem-extension and replace with:
// import { ViemExtension } from "@dynamic-labs/viem-extension";
// Then: const viemClient = dynamicClient.extend(ViemExtension());
//       const walletClient = await viemClient.viem.createWalletClient({ wallet: evmAccount, chain });
import { createWalletClient, http, custom } from "viem";
import { dynamicClient } from "@/lib/dynamic";
import { client as podsClient } from "./pods";
import type { Strategy, TransactionCall } from "./pods-types";
import { useWallet } from "@/lib/providers";

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
      // TODO: install @dynamic-labs/viem-extension and use ViemExtension for proper WaaS signing.
      // For now, fall back to window.ethereum (works for injected wallets only).
      const walletClient = createWalletClient({
        account: evmAccount.address as `0x${string}`,
        transport: typeof window !== "undefined" && (window as { ethereum?: unknown }).ethereum
          ? custom((window as { ethereum: { request: (args: unknown) => Promise<unknown> } }).ethereum)
          : http(),
      });

      let lastHash: string | undefined;
      for (const tx of bytecode) {
        const hash = await walletClient.sendTransaction({
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
      // TODO: install @dynamic-labs/viem-extension and use ViemExtension for proper WaaS signing.
      // For now, fall back to window.ethereum (works for injected wallets only).
      const walletClient = createWalletClient({
        account: evmAccount.address as `0x${string}`,
        transport: typeof window !== "undefined" && (window as { ethereum?: unknown }).ethereum
          ? custom((window as { ethereum: { request: (args: unknown) => Promise<unknown> } }).ethereum)
          : http(),
      });

      let lastHash: string | undefined;
      for (const tx of bytecode) {
        const hash = await walletClient.sendTransaction({
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
