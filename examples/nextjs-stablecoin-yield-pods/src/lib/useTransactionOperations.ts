import { useState, useCallback } from "react";
import { WalletClient } from "viem";
import { client as podsClient } from "./pods";
import type { Strategy, TransactionCall } from "./pods-types";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import { isZeroDevConnector } from "@dynamic-labs/ethereum-aa";

export function useTransactionOperations(
  walletClient: WalletClient | null,
  selectedChainId: number
) {
  const { primaryWallet } = useDynamicContext();
  const [isOperating, setIsOperating] = useState(false);
  const [operationError, setOperationError] = useState<Error | null>(null);

  const getKernelClient = useCallback(async () => {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) return null;
    const { connector } = primaryWallet;
    if (!isZeroDevConnector(connector)) return null;
    await connector.getNetwork();
    return connector.getAccountAbstractionProvider({ withSponsorship: true });
  }, [primaryWallet]);

  const executeBundledTransaction = useCallback(
    async (calls: TransactionCall[]): Promise<string> => {
      setIsOperating(true);
      setOperationError(null);
      try {
        const kernelClient = await getKernelClient();
        if (!kernelClient) throw new Error("Smart wallet unavailable");

        const callData = await kernelClient.account.encodeCalls(calls);
        const userOpHash = await kernelClient.sendUserOperation({ callData });
        const receipt = await kernelClient.waitForUserOperationReceipt({
          hash: userOpHash,
        });
        return receipt.receipt.transactionHash as string;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setOperationError(err);
        throw err;
      } finally {
        setIsOperating(false);
      }
    },
    [getKernelClient]
  );

  const executeDeposit = async (strategy: Strategy, amount: string) => {
    const walletAddress =
      primaryWallet?.address || walletClient?.account?.address;
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

      const kernelClient = await getKernelClient();
      if (kernelClient) {
        const calls: TransactionCall[] = bytecode.map((tx) => ({
          to: tx.to as `0x${string}`,
          value: BigInt(tx.value),
          data: tx.data as `0x${string}`,
        }));
        return await executeBundledTransaction(calls);
      }

      if (!walletClient?.account) throw new Error("Wallet client unavailable");
      let lastHash: string | undefined;
      for (const tx of bytecode) {
        const hash = await walletClient.sendTransaction({
          chain: walletClient.chain,
          account: walletClient.account,
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
  };

  const executeWithdraw = async (strategy: Strategy, amount: string) => {
    const walletAddress =
      primaryWallet?.address || walletClient?.account?.address;
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

      const kernelClient = await getKernelClient();
      if (kernelClient) {
        const calls: TransactionCall[] = bytecode.map((tx) => ({
          to: tx.to as `0x${string}`,
          value: BigInt(tx.value),
          data: tx.data as `0x${string}`,
        }));
        return await executeBundledTransaction(calls);
      }

      if (!walletClient?.account) throw new Error("Wallet client unavailable");
      let lastHash: string | undefined;
      for (const tx of bytecode) {
        const hash = await walletClient.sendTransaction({
          account: walletClient.account,
          to: tx.to as `0x${string}`,
          value: BigInt(tx.value),
          data: tx.data as `0x${string}`,
        } as Parameters<typeof walletClient.sendTransaction>[0]);
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
  };

  return {
    isOperating,
    operationError,
    executeDeposit,
    executeWithdraw,
  };
}
