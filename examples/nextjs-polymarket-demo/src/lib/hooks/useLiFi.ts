"use client";

import { getRoutes, executeRoute, type Route, type Token } from "@lifi/sdk";
import { useCallback, useState } from "react";
import { parseUnits, formatUnits } from "viem";

export interface LiFiSwapParams {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
}

export interface UseLiFiReturn {
  routes: Route[];
  isLoading: boolean;
  error: string | null;
  getRoutesForSwap: (params: LiFiSwapParams) => Promise<Route[]>;
  executeSwap: (
    route: Route,
    params: LiFiSwapParams
  ) => Promise<void>;
  clearError: () => void;
}

const GAS_MULTIPLIER = BigInt(250);
const GAS_DIVISOR = BigInt(100);
const DEFAULT_GAS = BigInt(800000);

function adjustGasLimit(txRequest: Record<string, unknown>): bigint {
  const gas = txRequest.gas ?? txRequest.gasLimit;
  if (gas) {
    return (
      (BigInt(gas as string | number | bigint) * GAS_MULTIPLIER) / GAS_DIVISOR
    );
  }
  return DEFAULT_GAS;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes("reverted")) {
      return "Transaction reverted. This may be due to price changes or insufficient liquidity. Please try again.";
    }
    if (err.message.includes("rejected") || err.message.includes("denied")) {
      return "Transaction rejected by user.";
    }
    if (err.message.includes("insufficient")) {
      return "Insufficient balance for this transaction.";
    }
    return err.message;
  }
  return "Deposit failed. Please try again.";
}

export function useLiFi(): UseLiFiReturn {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRoutesForSwap = useCallback(
    async (params: LiFiSwapParams): Promise<Route[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `https://li.quest/v1/tokens?chainIds=${params.fromChainId}`
        );
        const data = await res.json();
        const tokens = data.tokens[params.fromChainId] || [];
        const fromToken = tokens.find(
          (t: Token) =>
            t.address.toLowerCase() === params.fromTokenAddress.toLowerCase()
        );

        const decimals = fromToken?.decimals ?? 18;
        const amountInWei = parseUnits(params.fromAmount, decimals);

        const result = await getRoutes({
          fromChainId: params.fromChainId,
          toChainId: params.toChainId,
          fromTokenAddress: params.fromTokenAddress,
          toTokenAddress: params.toTokenAddress,
          fromAmount: amountInWei.toString(),
          fromAddress: params.fromAddress,
          toAddress: params.toAddress,
          options: {
            order: "RECOMMENDED",
            slippage: 0.03,
            allowSwitchChain: true,
          },
        });

        const availableRoutes = result.routes || [];
        setRoutes(availableRoutes);

        if (availableRoutes.length === 0) {
          setError("No routes available for this deposit");
        }

        return availableRoutes;
      } catch (err) {
        const msg = getErrorMessage(err);
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const executeSwap = useCallback(
    async (route: Route, _params: LiFiSwapParams) => {
      setIsLoading(true);
      setError(null);

      try {
        await executeRoute(route, {
          updateRouteHook: () => {},
          updateTransactionRequestHook: async (txRequest) => {
            const adjustedGas = adjustGasLimit(
              txRequest as unknown as Record<string, unknown>
            );
            return { ...txRequest, gas: adjustedGas, gasLimit: adjustedGas };
          },
          acceptExchangeRateUpdateHook: async ({
            oldToAmount,
            newToAmount,
            toToken,
          }) => {
            const oldAmt = parseFloat(
              formatUnits(BigInt(oldToAmount), toToken.decimals)
            );
            const newAmt = parseFloat(
              formatUnits(BigInt(newToAmount), toToken.decimals)
            );
            const change = ((newAmt - oldAmt) / oldAmt) * 100;
            if (Math.abs(change) <= 5) return true;
            return window.confirm(
              `Rate changed by ${change.toFixed(2)}%. Continue?`
            );
          },
          infiniteApproval: true,
        });
      } catch (err) {
        const msg = getErrorMessage(err);
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    routes,
    isLoading,
    error,
    getRoutesForSwap,
    executeSwap,
    clearError,
  };
}
