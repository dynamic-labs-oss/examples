"use client";

import { cn } from "@/lib/utils";
import { Chain, Token } from "@lifi/sdk";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

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
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [modalType, setModalType] = useState<"from" | "to">("from");
  const [searchQuery, setSearchQuery] = useState("");

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
      <div className="rounded-xl border border-[#DADADA] bg-white shadow-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2 text-[#030303]">Cross Chain Swap</h1>
          <p className="text-[#606060] text-sm">
            Swap tokens across different blockchain networks
          </p>
        </div>

        {/* From Section */}
        <div className="rounded-xl p-4 mb-4 border border-[#DADADA]" style={{ background: "#F9F9F9" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#030303]">From</span>
            <button
              onClick={() => openTokenModal("from")}
              className="flex items-center space-x-2 text-sm text-[#606060] hover:text-[#030303] cursor-pointer"
            >
              <span>{fromChain?.name || "Select Chain"}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => openTokenModal("from")}
                className="flex items-center space-x-2 text-lg font-semibold hover:bg-[#F9F9F9] rounded-lg px-2 py-1 cursor-pointer text-[#030303]"
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
                  <span className="text-[#606060]">Select token</span>
                )}
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          <input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full text-2xl font-semibold bg-transparent border-none outline-none text-[#030303]"
          />
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center mb-4">
          <button
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#F9F9F9] transition-colors cursor-pointer border border-[#DADADA] bg-white"
            onClick={() => {
              onFromChainChange(toChain);
              onToChainChange(fromChain);
              onFromTokenChange(toToken);
              onToTokenChange(fromToken);
            }}
          >
            <ArrowUpDown className="w-5 h-5 text-[#606060]" />
          </button>
        </div>

        {/* To Section */}
        <div className="rounded-xl p-4 mb-6 border border-[#DADADA]" style={{ background: "#F9F9F9" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#030303]">To</span>
            <button
              onClick={() => openTokenModal("to")}
              className="flex items-center space-x-2 text-sm text-[#606060] hover:text-[#030303] cursor-pointer"
            >
              <span>{toChain?.name || "Select Chain"}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => openTokenModal("to")}
                className="flex items-center space-x-2 text-lg font-semibold hover:bg-[#F9F9F9] rounded-lg px-2 py-1 cursor-pointer text-[#030303]"
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
                  <span className="text-[#606060]">Select token</span>
                )}
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="text-2xl font-semibold mb-2 text-[#030303]">0.00</div>
        </div>
      </div>

      {/* Token Selection Modal */}
      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent className="border border-[#DADADA] bg-white text-[#030303]">
          <DialogHeader>
            <DialogTitle>Select a token</DialogTitle>
          </DialogHeader>
          <div className="mb-4 overflow-hidden">
            <h3 className="text-sm font-medium text-[#606060] mb-3">
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
                      ? "border-[#4779FF] bg-[#4779FF]/10"
                      : "border-[#DADADA] bg-white"
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
              className="w-full pl-4 pr-4 py-3 border border-[#DADADA] rounded-xl focus:ring-2 focus:ring-[#4779FF] focus:border-[#4779FF] bg-white text-[#030303] outline-none"
            />
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => handleTokenSelect(token)}
                className={cn(
                  "w-full flex items-center space-x-3 p-3 rounded-xl transition-colors hover:bg-[#F9F9F9] border border-transparent cursor-pointer",
                  currentToken?.address === token.address &&
                    "bg-[#4779FF]/10 border-[#4779FF]"
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
                  <div className="font-medium text-[#030303]">{token.name}</div>
                  <div className="text-sm text-[#606060]">
                    {token.symbol}
                  </div>
                </div>
                {currentToken?.address === token.address && (
                  <div className="w-4 h-4 bg-[#4779FF] rounded-full border-2 border-white"></div>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
