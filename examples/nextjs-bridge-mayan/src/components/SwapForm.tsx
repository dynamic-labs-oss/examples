"use client";

import { useState, useMemo } from "react";
import { ChainKey } from "@/constants/chains";
import { Token } from "@mayanfinance/swap-sdk";

interface SimpleChain {
  id: number | string;
  name: string;
  key: ChainKey;
}

interface SwapFormProps {
  fromChain: SimpleChain | null;
  toChain: SimpleChain | null;
  fromToken: Token | null;
  toToken: Token | null;
  amount: string;
  fromChains: SimpleChain[];
  toChains: SimpleChain[];
  fromTokens: Token[];
  toTokens: Token[];
  isLoadingTokens: boolean;
  onFromChainChange: (chain: SimpleChain | null) => void;
  onToChainChange: (chain: SimpleChain | null) => void;
  onFromTokenChange: (token: Token | null) => void;
  onToTokenChange: (token: Token | null) => void;
  onAmountChange: (amount: string) => void;
  onRefreshTokens?: (chainId: number | string, isFromChain: boolean) => void;
}

export default function SwapForm({
  fromChain,
  toChain,
  fromToken,
  toToken,
  amount,
  fromChains,
  toChains,
  fromTokens,
  toTokens,
  isLoadingTokens,
  onFromChainChange,
  onToChainChange,
  onFromTokenChange,
  onToTokenChange,
  onAmountChange,
  onRefreshTokens,
}: SwapFormProps) {
  const [fromTokenSearch, setFromTokenSearch] = useState("");
  const [toTokenSearch, setToTokenSearch] = useState("");

  // Filter tokens based on search
  const filteredFromTokens = useMemo(() => {
    if (!fromTokenSearch) return fromTokens;
    const search = fromTokenSearch.toLowerCase();
    return fromTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(search) ||
        token.name.toLowerCase().includes(search) ||
        token.contract.toLowerCase().includes(search)
    );
  }, [fromTokens, fromTokenSearch]);

  const filteredToTokens = useMemo(() => {
    if (!toTokenSearch) return toTokens;
    const search = toTokenSearch.toLowerCase();
    return toTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(search) ||
        token.name.toLowerCase().includes(search) ||
        token.contract.toLowerCase().includes(search)
    );
  }, [toTokens, toTokenSearch]);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
        Swap Configuration
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 font-bold text-sm">→</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900">From</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chain
              </label>
              <select
                value={fromChain?.id || ""}
                onChange={(e) => {
                  const chainId = e.target.value;
                  const chain = fromChains.find((c) => c.id.toString() === chainId);
                  onFromChainChange(chain || null);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
              >
                <option value="">Select chain</option>
                {fromChains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search tokens..."
                  value={fromTokenSearch}
                  onChange={(e) => setFromTokenSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex space-x-2 min-w-0">
                  <select
                    value={fromToken?.contract || ""}
                    onChange={(e) => {
                      const token = fromTokens.find(
                        (t) => t.contract === e.target.value
                      );
                      onFromTokenChange(token || null);
                    }}
                    disabled={!fromChain || isLoadingTokens}
                    className="flex-1 min-w-0 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                  >
                    <option value="">
                      {isLoadingTokens ? "Loading tokens..." : "Select token"}
                    </option>
                    {filteredFromTokens.length === 0 && !isLoadingTokens ? (
                      <option value="" disabled>
                        {fromTokenSearch
                          ? "No tokens match search"
                          : "No tokens available"}
                      </option>
                    ) : (
                      filteredFromTokens.map((token) => (
                        <option key={token.contract} value={token.contract}>
                          {token.symbol} - {token.name}
                        </option>
                      ))
                    )}
                  </select>
                  {onRefreshTokens && fromChain && (
                    <button
                      onClick={() => onRefreshTokens(fromChain.id, true)}
                      disabled={isLoadingTokens}
                      className="flex-shrink-0 px-3 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Refresh tokens"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                {isLoadingTokens && (
                  <div className="flex items-center space-x-2 text-sm text-blue-600">
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Loading tokens for {fromChain?.name}...</span>
                  </div>
                )}
              </div>
              {fromTokens.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    {filteredFromTokens.length} of {fromTokens.length} tokens
                    shown
                  </p>
                  <div className="text-xs text-gray-400">
                    Popular:{" "}
                    {fromTokens
                      .slice(0, 3)
                      .map((t) => t.symbol)
                      .join(", ")}
                    {fromTokens.length > 3 && ` +${fromTokens.length - 3} more`}
                  </div>
                </div>
              )}
              {fromToken && (
                <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2">
                    {fromToken.logoURI && (
                      <img
                        src={fromToken.logoURI}
                        alt={fromToken.symbol}
                        className="w-6 h-6 rounded-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    )}
                    <div>
                      <div className="font-medium text-blue-900">
                        {fromToken.symbol}
                      </div>
                      <div className="text-xs text-blue-700">
                        {fromToken.name}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  placeholder="0.0"
                  disabled={!fromToken}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-bold text-sm">←</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900">To</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chain
              </label>
              <select
                value={toChain?.id || ""}
                onChange={(e) => {
                  const chainId = e.target.value;
                  const chain = toChains.find((c) => c.id.toString() === chainId);
                  onToChainChange(chain || null);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
              >
                <option value="">Select chain</option>
                {toChains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search tokens..."
                  value={toTokenSearch}
                  onChange={(e) => setToTokenSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex space-x-2 min-w-0">
                  <select
                    value={toToken?.contract || ""}
                    onChange={(e) => {
                      const token = toTokens.find(
                        (t) => t.contract === e.target.value
                      );
                      onToTokenChange(token || null);
                    }}
                    disabled={!toChain || isLoadingTokens}
                    className="flex-1 min-w-0 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                  >
                    <option value="">
                      {isLoadingTokens ? "Loading tokens..." : "Select token"}
                    </option>
                    {filteredToTokens.length === 0 && !isLoadingTokens ? (
                      <option value="" disabled>
                        {toTokenSearch
                          ? "No tokens match search"
                          : "No tokens available"}
                      </option>
                    ) : (
                      filteredToTokens.map((token) => (
                        <option key={token.contract} value={token.contract}>
                          {token.symbol} - {token.name}
                        </option>
                      ))
                    )}
                  </select>
                  {onRefreshTokens && toChain && (
                    <button
                      onClick={() => onRefreshTokens(toChain.id, false)}
                      disabled={isLoadingTokens}
                      className="flex-shrink-0 px-3 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Refresh tokens"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                {isLoadingTokens && (
                  <div className="flex items-center space-x-2 text-sm text-blue-600">
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Loading tokens for {toChain?.name}...</span>
                  </div>
                )}
              </div>
              {toTokens.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    {filteredToTokens.length} of {toTokens.length} tokens shown
                  </p>
                  <div className="text-xs text-gray-400">
                    Popular:{" "}
                    {toTokens
                      .slice(0, 3)
                      .map((t) => t.symbol)
                      .join(", ")}
                    {toTokens.length > 3 && ` +${toTokens.length - 3} more`}
                  </div>
                </div>
              )}
              {toToken && (
                <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-2">
                    {toToken.logoURI && (
                      <img
                        src={toToken.logoURI}
                        alt={toToken.symbol}
                        className="w-6 h-6 rounded-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    )}
                    <div>
                      <div className="font-medium text-green-900">
                        {toToken.symbol}
                      </div>
                      <div className="text-xs text-green-700">
                        {toToken.name}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="pt-8">
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300">
                <p className="text-sm text-gray-500 text-center">
                  Select tokens to see estimated output
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
