"use client";

import { useEffect, useState } from "react";
import { parseUnits } from "viem";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";

import { ALL_CHAINS, type ChainKey, isEVMChain } from "@/constants/chains";
import { fetchTokensForChain, type TokenData } from "@/lib/mayan-api";
import { useWallet } from "@/lib/providers";
import ActionButtons from "./ActionButtons";
import RouteDisplay from "./RouteDisplay";
import StatusMessages from "./StatusMessages";
import SwapForm from "./SwapForm";
import { fetchQuote, swapFromEvm } from "@mayanfinance/swap-sdk";
import type { Quote, Token } from "@mayanfinance/swap-sdk";

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
  const { evmAccount, loggedIn } = useWallet();

  const isConnected = loggedIn && !!evmAccount;
  const address = evmAccount?.address;

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

  const convertTokenDataToToken = (tokenData: TokenData): Token => {
    return {
      contract: tokenData.contract,
      symbol: tokenData.symbol,
      name: tokenData.name,
      decimals: tokenData.decimals,
      logoURI: tokenData.logoURI || "",
      chainId: tokenData.chainId,
      mint: tokenData.contract,
      coingeckoId: "",
      supportsPermit: false,
      verified: true,
      standard: "erc20",
    } as Token;
  };

  useEffect(() => {
    const loadTokens = async () => {
      if (!swapState.fromChain?.id || !swapState.toChain?.id) return;

      setIsLoadingTokens(true);
      try {
        if (isEVMChain(swapState.fromChain) && isEVMChain(swapState.toChain)) {
          const [fromTokensResponse, toTokensResponse] = await Promise.all([
            fetchTokensForChain(swapState.fromChain.id as number),
            fetchTokensForChain(swapState.toChain.id as number),
          ]);

          const sortedFromTokens = sortTokensByPopularity(
            fromTokensResponse.map(convertTokenDataToToken)
          );
          const sortedToTokens = sortTokensByPopularity(
            toTokensResponse.map(convertTokenDataToToken)
          );

          setFromTokens(sortedFromTokens);
          setToTokens(sortedToTokens);
        } else {
          setFromTokens([]);
          setToTokens([]);
        }

        setSwapState((prev) => ({
          ...prev,
          fromToken: null,
          toToken: null,
          quote: null,
        }));
      } catch {
        setFromTokens([]);
        setToTokens([]);
      } finally {
        setIsLoadingTokens(false);
      }
    };

    loadTokens();
  }, [swapState.fromChain?.id, swapState.toChain?.id]);

  const loadTokensForChain = async (
    chainId: number | string,
    isFromChain: boolean
  ) => {
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
      const sortedTokens = sortTokensByPopularity(
        tokens.map(convertTokenDataToToken)
      );

      if (isFromChain) {
        setFromTokens(sortedTokens);
        setSwapState((prev) => ({ ...prev, fromToken: null, quote: null }));
      } else {
        setToTokens(sortedTokens);
        setSwapState((prev) => ({ ...prev, toToken: null, quote: null }));
      }
    } catch {
      if (isFromChain) {
        setFromTokens([]);
      } else {
        setToTokens([]);
      }
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const sortTokensByPopularity = (tokens: Token[]): Token[] => {
    const popularSymbols = [
      "USDC", "USDT", "ETH", "WETH", "WBTC", "DAI", "MATIC", "BNB", "AVAX", "ARB",
    ];

    return tokens.sort((a, b) => {
      const aIndex = popularSymbols.findIndex((symbol) =>
        a.symbol.toUpperCase().includes(symbol.toUpperCase())
      );
      const bIndex = popularSymbols.findIndex((symbol) =>
        b.symbol.toUpperCase().includes(symbol.toUpperCase())
      );

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.symbol.localeCompare(b.symbol);
    });
  };

  const executeSwapQuote = async (quote: Quote) => {
    if (!isConnected || !address || !evmAccount || !quote) {
      throw new Error("Not ready");
    }

    // Use the JS SDK viem wallet client for signing
    const walletClient = createWalletClientForWalletAccount({
      walletAccount: evmAccount,
    });

    const result = await swapFromEvm(
      quote,
      address,
      address,
      null,
      walletClient as Parameters<typeof swapFromEvm>[3],
      null,
      null,
      null,
      {}
    );

    return result;
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
        quote,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setSwapState((prev) => ({
        ...prev,
        error: (error as Error).message || "Failed to get quote",
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
        error: error instanceof Error ? error.message : "Failed to execute swap",
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
    <div className="max-w-4xl mx-auto p-6 mt-6">
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
          setSwapState((prev) => ({ ...prev, fromChain: chain, fromToken: null }));
          if (chain) {
            loadTokensForChain(chain.id, true);
          }
        }}
        onToChainChange={(chain) => {
          setSwapState((prev) => ({ ...prev, toChain: chain, toToken: null }));
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
