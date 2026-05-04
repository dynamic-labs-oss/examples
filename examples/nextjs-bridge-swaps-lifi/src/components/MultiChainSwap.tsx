"use client";

import {
  executeRoute,
  getActiveRoutes,
  getChains,
  getRoutes,
  getTokens,
  resumeRoute,
  stopRouteExecution,
  updateRouteExecution,
  type ExecutionOptions,
  type Route,
  type RouteExtended,
  type Token,
} from "@lifi/sdk";
import { useEffect, useState, useCallback } from "react";
import { formatUnits, parseUnits } from "viem";
import { type Chain } from "@lifi/sdk";

import ActionButtons from "./ActionButtons";
import ExecutionDisplay from "./ExecutionDisplay";
import RouteDisplay from "./RouteDisplay";
import StatusMessages from "./StatusMessages";
import SwapForm from "./SwapForm";
import { useWallet } from "@/lib/providers";
import { LiFiProvider } from "@/lib/lifi-provider";

interface SwapState {
  fromChain: Chain | null;
  toChain: Chain | null;
  fromToken: Token | null;
  toToken: Token | null;
  amount: string;
  routes: Route[];
  selectedRoute: Route | null;
  isLoading: boolean;
  error: string | null;
  txHash: string | null;
  isExecuting: boolean;
  executionProgress: ExecutionProgress[];
  activeRoute: RouteExtended | null;
  isRouteCompleted: boolean;
  showRouteDisplay: boolean;
  showExecutionDisplay: boolean;
}

interface ExecutionProgress {
  stepIndex: number;
  stepType: string;
  status: string;
  txHash?: string;
  explorerLink?: string;
  chainId?: number;
  message: string;
}

function SwapContent() {
  const { evmAccount, loggedIn } = useWallet();

  const isConnected = loggedIn && !!evmAccount;
  const address = evmAccount?.address;

  const [swapState, setSwapState] = useState<SwapState>({
    fromChain: null,
    toChain: null,
    fromToken: null,
    toToken: null,
    amount: "0.000001",
    routes: [],
    selectedRoute: null,
    isLoading: false,
    error: null,
    txHash: null,
    isExecuting: false,
    executionProgress: [],
    activeRoute: null,
    isRouteCompleted: false,
    showRouteDisplay: false,
    showExecutionDisplay: false,
  });

  const [chains, setChains] = useState<Chain[]>([]);
  const [fromTokens, setFromTokens] = useState<Token[]>([]);
  const [toTokens, setToTokens] = useState<Token[]>([]);

  const monitorRouteExecution = useCallback(
    (route: RouteExtended) => {
      const progress: ExecutionProgress[] = [];

      route.steps.forEach((step, stepIndex) => {
        if (step.execution?.process) {
          step.execution.process.forEach((process) => {
            let chainId: number | undefined;

            if (stepIndex === 0) {
              chainId = swapState.fromChain?.id;
            } else {
              chainId = swapState.toChain?.id;
            }

            progress.push({
              stepIndex,
              stepType: process.type,
              status: process.status,
              txHash: process.txHash,
              explorerLink: process.explorerLink,
              chainId,
              message: `${process.type}: ${process.status}`,
            });
          });
        }
      });

      setSwapState((prev) => ({
        ...prev,
        executionProgress: progress,
        activeRoute: route,
      }));
    },
    [swapState.fromChain?.id, swapState.toChain?.id]
  );

  useEffect(() => {
    if (!isConnected) return;

    const checkActiveRoutes = () => {
      try {
        const activeRoutes = getActiveRoutes();
        if (activeRoutes.length > 0) {
          const route = activeRoutes[0];
          setSwapState((prev) => ({
            ...prev,
            activeRoute: route,
            isExecuting: true,
          }));
          monitorRouteExecution(route);
        }
      } catch {
        setSwapState((prev) => ({
          ...prev,
          error: "Failed to check active routes",
        }));
      }
    };

    checkActiveRoutes();
  }, [isConnected, monitorRouteExecution]);

  useEffect(() => {
    if (!isConnected) return;

    const fetchChains = async () => {
      try {
        const availableChains = await getChains();
        setChains(availableChains);

        if (availableChains.length >= 2) {
          setSwapState((prev) => ({
            ...prev,
            fromChain: availableChains[0],
            toChain: availableChains[1],
          }));
        }
      } catch {
        setSwapState((prev) => ({
          ...prev,
          error: "Failed to fetch available chains",
        }));
      }
    };

    fetchChains();
  }, [isConnected]);

  useEffect(() => {
    if (!swapState.fromChain || !swapState.toChain || !isConnected) return;

    const fetchTokens = async () => {
      try {
        const fromChainId = swapState.fromChain?.id;
        const toChainId = swapState.toChain?.id;

        if (!fromChainId || !toChainId) return;

        const [fromTokensResponse, toTokensResponse] = await Promise.all([
          getTokens({ chains: [fromChainId] }),
          getTokens({ chains: [toChainId] }),
        ]);

        const fromTokensList = fromTokensResponse.tokens[fromChainId] || [];
        const toTokensList = toTokensResponse.tokens[toChainId] || [];

        setFromTokens(fromTokensList);
        setToTokens(toTokensList);

        if (fromTokensList.length > 0) {
          setSwapState((prev) => ({ ...prev, fromToken: fromTokensList[0] }));
        }
        if (toTokensList.length > 0) {
          setSwapState((prev) => ({ ...prev, toToken: toTokensList[0] }));
        }
      } catch {
        setSwapState((prev) => ({
          ...prev,
          error: "Failed to fetch available tokens",
        }));
      }
    };

    fetchTokens();
  }, [swapState.fromChain, swapState.toChain, isConnected]);

  const getRoutesForSwap = async (
    fromChainId: number,
    toChainId: number,
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string
  ) => {
    if (!isConnected || !address) {
      throw new Error("Not ready");
    }

    const routes = await getRoutes({
      fromChainId,
      toChainId,
      fromTokenAddress,
      toTokenAddress,
      fromAmount: amount,
      fromAddress: address,
      toAddress: address,
      options: {
        order: "CHEAPEST",
        maxPriceImpact: 0.3,
        slippage: 0.005,
        fee: 0.01,
      },
    });

    return routes;
  };

  const executeSwapRoute = async (route: Route) => {
    if (!isConnected || !address || !route) {
      throw new Error("Not ready");
    }

    const executionOptions: ExecutionOptions = {
      updateRouteHook: (updatedRoute: RouteExtended) => {
        monitorRouteExecution(updatedRoute);

        const isComplete = updatedRoute.steps.every(
          (step) =>
            step.execution?.status === "DONE" ||
            step.execution?.status === "FAILED"
        );

        if (isComplete) {
          setSwapState((prev) => ({
            ...prev,
            isExecuting: false,
            txHash: "Execution completed",
            isRouteCompleted: true,
          }));
        }
      },
      updateTransactionRequestHook: async (txRequest) => {
        return txRequest;
      },
      acceptExchangeRateUpdateHook: async (params) => {
        const accepted = window.confirm(
          `Exchange rate has changed!\nOld amount: ${formatUnits(
            BigInt(params.oldToAmount),
            params.toToken.decimals
          )} ${params.toToken.symbol}\nNew amount: ${formatUnits(
            BigInt(params.newToAmount),
            params.toToken.decimals
          )} ${params.toToken.symbol}\n\nDo you want to continue?`
        );
        return accepted;
      },
      switchChainHook: async (_chainId) => {
        // Chain switching is handled automatically by the EVM provider
        return undefined;
      },
      executeInBackground: false,
      disableMessageSigning: false,
    };

    const result = await executeRoute(route, executionOptions);
    return result;
  };

  const handleGetRoutes = async () => {
    if (
      !swapState.fromChain ||
      !swapState.toChain ||
      !swapState.fromToken ||
      !swapState.toToken ||
      !swapState.amount ||
      !isConnected
    ) {
      setSwapState((prev) => ({
        ...prev,
        error: "Please fill in all required fields and connect wallet",
      }));
      return;
    }

    setSwapState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      routes: [],
      selectedRoute: null,
    }));

    try {
      const amountInWei = parseUnits(
        swapState.amount,
        swapState.fromToken.decimals
      );

      const routesResult = await getRoutesForSwap(
        swapState.fromChain.id,
        swapState.toChain.id,
        swapState.fromToken.address,
        swapState.toToken.address,
        amountInWei.toString()
      );

      const availableRoutes = routesResult.routes || [];
      setSwapState((prev) => ({
        ...prev,
        routes: availableRoutes,
        selectedRoute: availableRoutes[0] || null,
        isLoading: false,
        error: availableRoutes.length === 0 ? "No routes found" : null,
        showRouteDisplay: availableRoutes.length > 0,
      }));
    } catch (error) {
      setSwapState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to get routes",
        isLoading: false,
      }));
    }
  };

  const handleExecuteSwap = async () => {
    if (!swapState.selectedRoute || !isConnected) {
      setSwapState((prev) => ({
        ...prev,
        error: "No route selected or wallet not connected",
      }));
      return;
    }

    setSwapState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      txHash: null,
      isExecuting: true,
      executionProgress: [],
      showExecutionDisplay: true,
    }));

    try {
      await executeSwapRoute(swapState.selectedRoute);
      setSwapState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    } catch (error) {
      setSwapState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to execute swap",
        isLoading: false,
        isExecuting: false,
      }));
    }
  };

  const handleResumeRoute = async () => {
    if (!swapState.activeRoute) return;

    try {
      setSwapState((prev) => ({ ...prev, isLoading: true }));
      await resumeRoute(swapState.activeRoute);
      setSwapState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setSwapState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to resume route",
        isLoading: false,
      }));
    }
  };

  const handleStopRoute = () => {
    if (!swapState.activeRoute) return;

    try {
      stopRouteExecution(swapState.activeRoute);
      setSwapState((prev) => ({
        ...prev,
        isExecuting: false,
        activeRoute: null,
        executionProgress: [],
      }));
    } catch {
      setSwapState((prev) => ({
        ...prev,
        error: "Failed to stop route execution",
      }));
    }
  };

  const handleMoveToBackground = () => {
    if (!swapState.activeRoute) return;

    try {
      updateRouteExecution(swapState.activeRoute, {
        executeInBackground: true,
      });
      setSwapState((prev) => ({
        ...prev,
        isExecuting: false,
      }));
    } catch {
      setSwapState((prev) => ({
        ...prev,
        error: "Failed to move route to background",
      }));
    }
  };

  const clearState = () => {
    setSwapState((prev) => ({
      ...prev,
      routes: [],
      selectedRoute: null,
      error: null,
      txHash: null,
      executionProgress: [],
      activeRoute: null,
      isRouteCompleted: false,
      showRouteDisplay: false,
      showExecutionDisplay: false,
    }));
  };

  const handleBackToForm = () => {
    setSwapState((prev) => ({
      ...prev,
      showRouteDisplay: false,
      showExecutionDisplay: false,
      isExecuting: false,
      executionProgress: [],
      activeRoute: null,
      isRouteCompleted: false,
      txHash: null,
      error: null,
    }));
  };

  const handleShowExecutionDisplay = () => {
    setSwapState((prev) => ({
      ...prev,
      showExecutionDisplay: true,
    }));
  };

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {swapState.showExecutionDisplay ? (
          <ExecutionDisplay
            activeRoute={swapState.activeRoute}
            isExecuting={swapState.isExecuting}
            isRouteCompleted={swapState.isRouteCompleted}
            executionProgress={swapState.executionProgress}
            onResumeRoute={handleResumeRoute}
            onMoveToBackground={handleMoveToBackground}
            onStopRoute={handleStopRoute}
            onBackToForm={handleBackToForm}
          />
        ) : swapState.showRouteDisplay ? (
          <>
            <RouteDisplay
              routes={swapState.routes}
              selectedRoute={swapState.selectedRoute}
              toTokenSymbol={swapState.toToken?.symbol}
              onRouteSelect={(route) =>
                setSwapState((prev) => ({
                  ...prev,
                  selectedRoute: route,
                }))
              }
              onBackToForm={handleBackToForm}
            />

            <ActionButtons
              isLoading={swapState.isLoading}
              isExecuting={swapState.isExecuting}
              hasRoutes={swapState.routes.length > 0}
              hasSelectedRoute={!!swapState.selectedRoute}
              showRouteDisplay={swapState.showRouteDisplay}
              hasActiveRoute={!!swapState.activeRoute}
              isConnected={isConnected}
              onGetRoutes={handleGetRoutes}
              onExecuteSwap={handleExecuteSwap}
              onClear={clearState}
              onBackToForm={handleBackToForm}
              onShowExecutionDisplay={handleShowExecutionDisplay}
            />

            <StatusMessages
              error={swapState.error}
              txHash={swapState.txHash}
              chainId={swapState.fromChain?.id}
            />
          </>
        ) : (
          <>
            <SwapForm
              fromChain={swapState.fromChain}
              toChain={swapState.toChain}
              fromToken={swapState.fromToken}
              toToken={swapState.toToken}
              amount={swapState.amount}
              chains={chains}
              fromTokens={fromTokens}
              toTokens={toTokens}
              onFromChainChange={(chain) =>
                setSwapState((prev) => ({
                  ...prev,
                  fromChain: chain,
                  fromToken: null,
                }))
              }
              onToChainChange={(chain) =>
                setSwapState((prev) => ({
                  ...prev,
                  toChain: chain,
                  toToken: null,
                }))
              }
              onFromTokenChange={(token) =>
                setSwapState((prev) => ({
                  ...prev,
                  fromToken: token,
                }))
              }
              onToTokenChange={(token) =>
                setSwapState((prev) => ({
                  ...prev,
                  toToken: token,
                }))
              }
              onAmountChange={(amount) =>
                setSwapState((prev) => ({
                  ...prev,
                  amount,
                }))
              }
            />

            <ActionButtons
              isLoading={swapState.isLoading}
              isExecuting={swapState.isExecuting}
              hasRoutes={swapState.routes.length > 0}
              hasSelectedRoute={!!swapState.selectedRoute}
              showRouteDisplay={swapState.showRouteDisplay}
              hasActiveRoute={!!swapState.activeRoute}
              isConnected={isConnected}
              onGetRoutes={handleGetRoutes}
              onExecuteSwap={handleExecuteSwap}
              onClear={clearState}
              onBackToForm={handleBackToForm}
              onShowExecutionDisplay={handleShowExecutionDisplay}
            />

            <StatusMessages
              error={swapState.error}
              txHash={swapState.txHash}
              chainId={swapState.fromChain?.id}
            />
          </>
        )}
      </div>
    </main>
  );
}

export default function MultiChainSwap() {
  const { loggedIn } = useWallet();

  if (!loggedIn) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-[#DADADA] bg-white shadow-sm p-6 text-center">
            <h2 className="text-2xl font-bold text-[#030303] mb-4">Cross-Chain Swap</h2>
            <p className="text-[#606060] mb-4">
              Please sign in to use the multi-chain swap feature.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <LiFiProvider>
      <SwapContent />
    </LiFiProvider>
  );
}
