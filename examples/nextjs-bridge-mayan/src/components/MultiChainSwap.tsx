"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { getSigner } from "@dynamic-labs/ethers-v6";
import { useEffect, useState } from "react";
import { parseUnits } from "viem";

import { ALL_CHAINS, type ChainKey, isEVMChain } from "@/constants/chains";
import { fetchTokensForChain, type TokenData } from "@/lib/mayan-api";
import ActionButtons from "./ActionButtons";
import RouteDisplay from "./RouteDisplay";
import StatusMessages from "./StatusMessages";
import SwapForm from "./SwapForm";
import { fetchQuote, swapFromEvm } from "@mayanfinance/swap-sdk";
import type { Quote, Token } from "@mayanfinance/swap-sdk";
import { isEthereumWallet } from "@dynamic-labs/ethereum";

interface SimpleChain {
  id: number | string;
  name: string;
  key: ChainKey;
}

interface SwapState {
  fromChain: SimpleChain | null;
  toChain: SimpleChain | null;
  fromToken: Token | null;
  toToken: Token | null;
  amount: string;
  quote: Quote | null;
  isLoading: boolean;
  error: string | null;
  txHash: string | null;
  isExecuting: boolean;
}

export default function MultiChainSwap() {
  const { primaryWallet, sdkHasLoaded } = useDynamicContext();

  const isConnected = !!primaryWallet;
  const address = primaryWallet?.address;

  const [swapState, setSwapState] = useState<SwapState>({
    fromChain: ALL_CHAINS[0],
    toChain: ALL_CHAINS[1],
    fromToken: null,
    toToken: null,
    amount: "0.000001",
    quote: null,
    isLoading: false,
    error: null,
    txHash: null,
    isExecuting: false,
  });
  const [fromTokens, setFromTokens] = useState<Token[]>([]);
  const [toTokens, setToTokens] = useState<Token[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  // Convert TokenData to Token (Mayan SDK format)
  const convertTokenDataToToken = (tokenData: TokenData): Token => {
    return {
      contract: tokenData.contract,
      symbol: tokenData.symbol,
      name: tokenData.name,
      decimals: tokenData.decimals,
      logoURI: tokenData.logoURI || "",
      chainId: tokenData.chainId,
      mint: tokenData.contract, // Use contract address as mint for EVM
      coingeckoId: "", // Not available in TokenData
      supportsPermit: false, // Default to false
      verified: true, // Assume verified if we're fetching from API
      standard: "erc20", // Use lowercase for TokenStandard
    } as Token;
  };

  // Load tokens when chains change
  useEffect(() => {
    const loadTokens = async () => {
      if (!swapState.fromChain?.id || !swapState.toChain?.id) return;

      setIsLoadingTokens(true);
      try {
        // Only load tokens for EVM chains (those with numeric IDs)
        if (isEVMChain(swapState.fromChain) && isEVMChain(swapState.toChain)) {
          const [fromTokensResponse, toTokensResponse] = await Promise.all([
            fetchTokensForChain(swapState.fromChain.id as number),
            fetchTokensForChain(swapState.toChain.id as number),
          ]);

          // Convert TokenData to Token and sort by popularity
          const sortedFromTokens = sortTokensByPopularity(
            fromTokensResponse.map(convertTokenDataToToken)
          );
          const sortedToTokens = sortTokensByPopularity(
            toTokensResponse.map(convertTokenDataToToken)
          );

          setFromTokens(sortedFromTokens);
          setToTokens(sortedToTokens);
        } else {
          // For non-EVM chains, set empty token arrays for now
          setFromTokens([]);
          setToTokens([]);
        }

        // Clear token selections when chains change
        setSwapState((prev) => ({
          ...prev,
          fromToken: null,
          toToken: null,
          quote: null,
        }));
      } catch (error) {
        console.error("Error loading tokens:", error);
        // Set empty arrays on error to prevent stale data
        setFromTokens([]);
        setToTokens([]);
      } finally {
        setIsLoadingTokens(false);
      }
    };

    loadTokens();
  }, [swapState.fromChain?.id, swapState.toChain?.id]);

  // Enhanced token loading function that can be called manually
  const loadTokensForChain = async (
    chainId: number | string,
    isFromChain: boolean
  ) => {
    // Only load tokens for EVM chains (those with numeric IDs)
    if (typeof chainId !== "number") {
      if (isFromChain) {
        setFromTokens([]);
      } else {
        setToTokens([]);
      }
      return;
    }

    setIsLoadingTokens(true);
    try {
      const tokens = await fetchTokensForChain(chainId);

      // Convert TokenData to Token and sort by popularity
      const sortedTokens = sortTokensByPopularity(
        tokens.map(convertTokenDataToToken)
      );

      if (isFromChain) {
        setFromTokens(sortedTokens);
        setSwapState((prev) => ({
          ...prev,
          fromToken: null,
          quote: null,
        }));
      } else {
        setToTokens(sortedTokens);
        setSwapState((prev) => ({
          ...prev,
          toToken: null,
          quote: null,
        }));
      }
    } catch (error) {
      console.error(`Error loading tokens for chain ${chainId}:`, error);
      if (isFromChain) {
        setFromTokens([]);
      } else {
        setToTokens([]);
      }
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Sort tokens by popularity (common tokens first)
  const sortTokensByPopularity = (tokens: Token[]): Token[] => {
    const popularSymbols = [
      "USDC",
      "USDT",
      "ETH",
      "WETH",
      "WBTC",
      "DAI",
      "MATIC",
      "BNB",
      "AVAX",
      "ARB",
    ];

    return tokens.sort((a, b) => {
      const aIndex = popularSymbols.findIndex((symbol) =>
        a.symbol.toUpperCase().includes(symbol.toUpperCase())
      );
      const bIndex = popularSymbols.findIndex((symbol) =>
        b.symbol.toUpperCase().includes(symbol.toUpperCase())
      );

      // If both are popular, sort by popularity index
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // If only one is popular, popular one goes first
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // If neither is popular, sort alphabetically by symbol
      return a.symbol.localeCompare(b.symbol);
    });
  };

  const executeSwapQuote = async (quote: Quote) => {
    if (!sdkHasLoaded || !isConnected || !address || !quote) {
      throw new Error("Not ready");
    }

    if (primaryWallet && isEthereumWallet(primaryWallet)) {
      try {
        // Get the ethers signer from Dynamic
        const signer = await getSigner(primaryWallet);

        // Execute the swap using the Mayan SDK with ethers signer
        const result = await swapFromEvm(
          quote,
          address, // swapperAddress
          address, // destinationAddress
          null, // referrerAddresses
          signer, // signer (ethers)
          null, // permit
          null, // overrides
          null, // payload
          {} // options
        );

        return result;
      } catch (error) {
        throw error;
      }
    }
  };

  const handleGetQuote = async () => {
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
      quote: null,
    }));

    try {
      const amountInWei = parseUnits(
        swapState.amount,
        swapState.fromToken.decimals
      );

      if (
        !swapState.fromChain ||
        !swapState.toChain ||
        !swapState.fromToken ||
        !swapState.toToken
      ) {
        throw new Error("Invalid chain or token selection");
      }

      // The chain objects are already SimpleChain objects with id property
      const fromChain = swapState.fromChain;
      const toChain = swapState.toChain;
      const fromToken = swapState.fromToken;
      const toToken = swapState.toToken;

      if (!fromChain || !toChain || !fromToken || !toToken) {
        throw new Error("Invalid chain or token selection");
      }

      const quote = (
        await fetchQuote({
          amountIn64: amountInWei.toString(),
          fromToken: fromToken.contract,
          toToken: toToken.contract,
          fromChain: fromChain.key,
          toChain: toChain.key,
          slippageBps: "auto",
        })
      )[0];

      if (!quote) {
        throw new Error("No quote available for this swap");
      }

      setSwapState((prev) => ({
        ...prev,
        quote: quote,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setSwapState((prev) => ({
        ...prev,
        error: (error as unknown as Error).message || "Failed to get quote",
        isLoading: false,
      }));
    }
  };

  const handleExecuteSwap = async () => {
    if (!swapState.quote || !isConnected) {
      setSwapState((prev) => ({
        ...prev,
        error: "No quote available or wallet not connected",
      }));
      return;
    }

    setSwapState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      txHash: null,
      isExecuting: true,
    }));

    try {
      const result = await executeSwapQuote(swapState.quote);
      setSwapState((prev) => ({
        ...prev,
        isLoading: false,
        txHash: typeof result === "string" ? result : "Transaction submitted",
        isExecuting: false,
      }));
    } catch (error) {
      setSwapState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Failed to execute swap",
        isLoading: false,
        isExecuting: false,
      }));
    }
  };

  const handleClearError = () => {
    setSwapState((prev) => ({ ...prev, error: null }));
  };

  const handleClearTxHash = () => {
    setSwapState((prev) => ({ ...prev, txHash: null }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 mt-20">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Mayan Cross-Chain Swap
        </h1>
        <p className="text-gray-600">
          Swap tokens across different blockchain networks using Mayan
        </p>
      </div>

      <SwapForm
        fromChain={swapState.fromChain}
        toChain={swapState.toChain}
        fromToken={swapState.fromToken}
        toToken={swapState.toToken}
        amount={swapState.amount}
        chains={ALL_CHAINS}
        fromTokens={fromTokens}
        toTokens={toTokens}
        isLoadingTokens={isLoadingTokens}
        onFromChainChange={(chain) => {
          setSwapState((prev) => ({
            ...prev,
            fromChain: chain,
            fromToken: null,
          }));
          // Auto-load tokens for the selected chain
          if (chain) {
            loadTokensForChain(chain.id, true);
          }
        }}
        onToChainChange={(chain) => {
          setSwapState((prev) => ({
            ...prev,
            toChain: chain,
            toToken: null,
          }));
          // Auto-load tokens for the selected chain
          if (chain) {
            loadTokensForChain(chain.id, false);
          }
        }}
        onFromTokenChange={(token) =>
          setSwapState((prev) => ({ ...prev, fromToken: token }))
        }
        onToTokenChange={(token) =>
          setSwapState((prev) => ({ ...prev, toToken: token }))
        }
        onAmountChange={(amount) =>
          setSwapState((prev) => ({ ...prev, amount }))
        }
        onRefreshTokens={loadTokensForChain}
      />

      <ActionButtons
        onGetQuote={handleGetQuote}
        onExecuteSwap={handleExecuteSwap}
        isLoading={swapState.isLoading}
        isExecuting={swapState.isExecuting}
        hasQuote={!!swapState.quote}
        isConnected={isConnected}
      />

      <StatusMessages
        error={swapState.error}
        txHash={swapState.txHash}
        onClearError={handleClearError}
        onClearTxHash={handleClearTxHash}
      />

      <RouteDisplay
        quote={swapState.quote}
        toTokenSymbol={swapState.toToken?.symbol}
      />
    </div>
  );
}
