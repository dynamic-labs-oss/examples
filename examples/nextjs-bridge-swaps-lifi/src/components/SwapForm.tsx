"use client";

import { cn } from "@/lib/utils";
import { Chain, Token } from "@lifi/sdk";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useTokenBalances } from "@dynamic-labs/sdk-react-core";

interface SwapFormProps {
  fromChain: Chain | null;
  toChain: Chain | null;
  fromToken: Token | null;
  toToken: Token | null;
  amount: string;
  chains: Chain[];
  fromTokens: Token[];
  toTokens: Token[];
  onFromChainChange: (chain: Chain | null) => void;
  onToChainChange: (chain: Chain | null) => void;
  onFromTokenChange: (token: Token | null) => void;
  onToTokenChange: (token: Token | null) => void;
  onAmountChange: (amount: string) => void;
}

export default function SwapForm({
  fromChain,
  toChain,
  fromToken,
  toToken,
  amount,
  chains,
  fromTokens,
  toTokens,
  onFromChainChange,
  onToChainChange,
  onFromTokenChange,
  onToTokenChange,
  onAmountChange,
}: SwapFormProps) {
  // Modal states
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [modalType, setModalType] = useState<"from" | "to">("from");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch token balances using Dynamic's useTokenBalances hook
  const { tokenBalances: fromTokenBalances, isLoading: isLoadingFromBalances } =
    useTokenBalances({
      networkId: fromChain?.id,
      includeNativeBalance: true,
      includeFiat: false,
    });

  const { tokenBalances: toTokenBalances, isLoading: isLoadingToBalances } =
    useTokenBalances({
      networkId: toChain?.id,
      includeNativeBalance: true,
      includeFiat: false,
    });

  // Helper function to get balance for a specific token
  const getTokenBalance = (
    token: Token | null,
    balances:
      | Array<{
          address?: string;
          isNative?: boolean;
          balance: number;
        }>
      | undefined
  ) => {
    if (!token || !balances) return "0.00";

    // For native tokens, look for the native balance
    if (
      token.address === "0x0000000000000000000000000000000000000000" ||
      !token.address
    ) {
      // Look for native token by zero address or isNative flag
      const nativeBalance = balances.find(
        (balance) =>
          balance.isNative ||
          balance.address === "0x0000000000000000000000000000000000000000"
      );

      return nativeBalance ? nativeBalance.balance.toFixed(4) : "0.00";
    }

    // For ERC-20 tokens, look for matching address
    const tokenBalance = balances.find(
      (balance) =>
        balance.address?.toLowerCase() === token.address?.toLowerCase()
    );

    return tokenBalance ? tokenBalance.balance.toFixed(4) : "0.00";
  };

  // Get balances for current tokens
  const fromTokenBalance = getTokenBalance(fromToken, fromTokenBalances);
  const toTokenBalance = getTokenBalance(toToken, toTokenBalances);

  // Modal handlers
  const handleChainSelect = (chain: Chain) => {
    if (modalType === "from") {
      onFromChainChange(chain);
    } else {
      onToChainChange(chain);
    }
  };

  const handleTokenSelect = (token: Token) => {
    if (modalType === "from") {
      onFromTokenChange(token);
    } else {
      onToTokenChange(token);
    }
    setShowTokenModal(false);
    setSearchQuery("");
  };

  const openTokenModal = (type: "from" | "to") => {
    setModalType(type);
    setShowTokenModal(true);
  };

  const filteredTokens = useMemo(
    () =>
      (modalType === "from" ? fromTokens : toTokens).filter((token) => {
        const q = searchQuery.toLowerCase();
        return (
          token.symbol.toLowerCase().includes(q) ||
          token.name.toLowerCase().includes(q)
        );
      }),
    [modalType, fromTokens, toTokens, searchQuery]
  );

  const currentChain = modalType === "from" ? fromChain : toChain;
  const currentToken = modalType === "from" ? fromToken : toToken;

  return (
    <div className="w-full max-w-md">
      {/* Swap Card */}
      <div className="bg-card text-card-foreground rounded-2xl shadow-lg p-6 border border-border">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Cross Chain Swap</h1>
          <p className="text-muted-foreground text-sm">
            Swap tokens across different blockchain networks
          </p>
        </div>

        {/* From Section */}
        <div className="bg-muted/40 rounded-xl p-4 mb-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">From</span>
            <button
              onClick={() => openTokenModal("from")}
              className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <span>{fromChain?.name || "Select Chain"}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => openTokenModal("from")}
                className="flex items-center space-x-2 text-lg font-semibold hover:bg-accent hover:text-accent-foreground rounded-lg px-2 py-1 cursor-pointer"
              >
                {fromToken ? (
                  <>
                    {fromToken?.logoURI ? (
                      <Image
                        src={fromToken.logoURI}
                        alt={`${fromToken.symbol} logo`}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full"
                        unoptimized
                      />
                    ) : (
                      <span className="text-2xl">🪙</span>
                    )}
                    <span>{fromToken.symbol}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Select token</span>
                )}
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <button
              className="text-sm text-primary hover:underline font-medium cursor-pointer"
              onClick={() => {
                // Set max amount to the actual balance
                if (fromTokenBalance && fromTokenBalance !== "0.00") {
                  onAmountChange(fromTokenBalance);
                }
              }}
              disabled={
                !fromTokenBalance ||
                fromTokenBalance === "0.00" ||
                isLoadingFromBalances
              }
            >
              Max
            </button>
          </div>

          <input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full text-2xl font-semibold bg-transparent border-none outline-none"
          />

          <div className="text-sm text-muted-foreground mt-2">
            <span className="border-b border-dashed border-border w-full block h-4"></span>
          </div>

          {fromToken && (
            <div className="text-sm text-muted-foreground mt-1">
              Balance:{" "}
              {isLoadingFromBalances
                ? "Loading..."
                : `${fromTokenBalance} ${fromToken.symbol}`}
            </div>
          )}
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center mb-4">
          <button
            className="w-10 h-10 bg-accent text-accent-foreground rounded-full flex items-center justify-center hover:bg-accent/80 transition-colors cursor-pointer"
            onClick={() => {
              onFromChainChange(toChain);
              onToChainChange(fromChain);
              onFromTokenChange(toToken);
              onToTokenChange(fromToken);
            }}
          >
            <ArrowUpDown className="w-5 h-5" />
          </button>
        </div>

        {/* To Section */}
        <div className="bg-muted/40 rounded-xl p-4 mb-6 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">To</span>
            <button
              onClick={() => openTokenModal("to")}
              className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <span>{toChain?.name || "Select Chain"}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => openTokenModal("to")}
                className="flex items-center space-x-2 text-lg font-semibold hover:bg-accent hover:text-accent-foreground rounded-lg px-2 py-1 cursor-pointer"
              >
                {toToken ? (
                  <>
                    {toToken?.logoURI ? (
                      <Image
                        src={toToken.logoURI}
                        alt={`${toToken.symbol} logo`}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full"
                        unoptimized
                      />
                    ) : (
                      <span className="text-2xl">🪙</span>
                    )}
                    <span>{toToken.symbol}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Select token</span>
                )}
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="text-2xl font-semibold mb-2">0.00</div>

          <div className="text-sm text-muted-foreground mt-2">
            <span className="border-b border-dashed border-border w-full block h-4"></span>
          </div>

          {toToken && (
            <div className="text-sm text-muted-foreground mt-1">
              Balance:{" "}
              {isLoadingToBalances
                ? "Loading..."
                : `${toTokenBalance} ${toToken.symbol}`}
            </div>
          )}
        </div>
      </div>

      {/* Token Selection Modal */}
      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent className="border border-border bg-popover text-popover-foreground">
          <DialogHeader>
            <DialogTitle>Select a token</DialogTitle>
          </DialogHeader>
          <div className="mb-4 overflow-hidden">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Available chains
            </h3>
            <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide w-full min-w-0">
              {chains.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => handleChainSelect(chain)}
                  className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg border cursor-pointer",
                    currentChain?.id === chain.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background"
                  )}
                >
                  <Image
                    src={chain.logoURI || ""}
                    alt={chain.name}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search for a token"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-4 py-3 border border-input rounded-xl focus:ring-2 focus:ring-ring focus:border-ring bg-background"
            />
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => handleTokenSelect(token)}
                className={cn(
                  "w-full flex items-center space-x-3 p-3 rounded-xl transition-colors hover:bg-accent hover:text-accent-foreground border border-transparent cursor-pointer",
                  currentToken?.address === token.address &&
                    "bg-primary/10 border-primary"
                )}
              >
                {token.logoURI ? (
                  <Image
                    src={token.logoURI}
                    alt={`${token.symbol} logo`}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full"
                    unoptimized
                  />
                ) : (
                  <span className="text-2xl">🪙</span>
                )}
                <div className="flex-1 text-left">
                  <div className="font-medium">{token.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {token.symbol}
                  </div>
                </div>
                {currentToken?.address === token.address && (
                  <div className="w-4 h-4 bg-primary rounded-full border-2 border-background"></div>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
