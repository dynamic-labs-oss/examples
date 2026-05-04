"use client";

import { useWallet } from "@/lib/providers";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useLiFi } from "@/lib/hooks/useLiFi";
import { loadLiFiChains, loadLiFiTokens } from "@/lib/lifi";
import type { Token } from "@lifi/sdk";
import { BodyText } from "@/components/ui/Typography";
import { POLYGON_MAINNET_CHAIN_ID } from "@/lib/constants/network";
import { getContractAddress } from "@/lib/constants/contracts";
import { polygon } from "viem/chains";

interface LiFiViewProps {
  embeddedWalletAddress: string;
  onBack: () => void;
}

type View = "select" | "amount" | "executing" | "success";

interface SimpleChain {
  id: number;
  name: string;
}

const isNativeToken = (address?: string): boolean => {
  if (!address) return true;
  const addr = address.toLowerCase();
  return (
    addr === "0x0000000000000000000000000000000000000000" ||
    addr === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  );
};

export function LiFiView({ embeddedWalletAddress, onBack }: LiFiViewProps) {
  const { evmAccount } = useWallet();
  const [view, setView] = useState<View>("select");
  const [chains, setChains] = useState<SimpleChain[]>([]);
  const [fromChain, setFromChain] = useState<SimpleChain | null>({
    id: POLYGON_MAINNET_CHAIN_ID,
    name: "Polygon",
  });
  const [toChain] = useState<SimpleChain>({
    id: POLYGON_MAINNET_CHAIN_ID,
    name: "Polygon",
  });
  const [fromTokens, setFromTokens] = useState<Token[]>([]);
  const [selectedFromToken, setSelectedFromToken] = useState<Token | null>(
    null
  );
  const [selectedToToken, setSelectedToToken] = useState<Token | null>(null);
  const [tokenAmount, setTokenAmount] = useState("");

  // Without React SDK's useTokenBalances, we disable balance pre-filtering.
  const tokenBalances: { address?: string; balance: number; networkId: number }[] = [];
  const isLoadingBalances = false;

  const { getRoutesForSwap, executeSwap, isLoading, error, clearError } =
    useLiFi();

  // Load chains
  useEffect(() => {
    loadLiFiChains().then((availableChains) => {
      const simpleChains = availableChains.map((c) => ({
        id: c.id,
        name: c.name,
      }));
      setChains(simpleChains);
    });
  }, []);

  // Load destination token (USDC on Polygon)
  useEffect(() => {
    loadLiFiTokens(POLYGON_MAINNET_CHAIN_ID).then((tokens) => {
      const usdcAddress = getContractAddress(POLYGON_MAINNET_CHAIN_ID, "USD");
      const usdc = tokens.find(
        (t) =>
          usdcAddress && t.address.toLowerCase() === usdcAddress.toLowerCase()
      );
      if (usdc) setSelectedToToken(usdc);
    });
  }, []);

  // User's tokens with balance
  const userTokensWithBalance = useMemo(() => {
    if (!tokenBalances || !fromChain) return [];
    return tokenBalances.filter(
      (b) => b.networkId === fromChain.id && b.balance > 0
    );
  }, [tokenBalances, fromChain]);

  // Load tokens user has balance for
  useEffect(() => {
    if (!fromChain) return;
    loadLiFiTokens(fromChain.id).then((allTokens) => {
      const filtered = allTokens.filter((token) => {
        if (isNativeToken(token.address)) {
          return userTokensWithBalance.some((b) => isNativeToken(b.address));
        }
        return userTokensWithBalance.some(
          (b) => b.address.toLowerCase() === token.address.toLowerCase()
        );
      });
      setFromTokens(filtered);
      if (filtered.length > 0 && !selectedFromToken) {
        setSelectedFromToken(filtered[0]);
      }
    });
  }, [fromChain, userTokensWithBalance, selectedFromToken]);

  // Get balance for selected token
  const userBalance = useMemo(() => {
    if (!selectedFromToken) return null;
    if (isNativeToken(selectedFromToken.address)) {
      return userTokensWithBalance.find((b) => isNativeToken(b.address));
    }
    return userTokensWithBalance.find(
      (b) => b.address.toLowerCase() === selectedFromToken.address.toLowerCase()
    );
  }, [selectedFromToken, userTokensWithBalance]);

  const handleExecute = useCallback(async () => {
    if (
      !evmAccount?.address ||
      !selectedFromToken ||
      !selectedToToken ||
      !fromChain ||
      !tokenAmount
    )
      return;

    try {
      clearError();
      setView("executing");

      const routes = await getRoutesForSwap({
        fromChainId: fromChain.id,
        toChainId: toChain.id,
        fromTokenAddress: selectedFromToken.address,
        toTokenAddress: selectedToToken.address,
        fromAmount: tokenAmount,
        fromAddress: evmAccount.address,
        toAddress: embeddedWalletAddress,
      });

      if (routes.length === 0) throw new Error("No routes found");

      await executeSwap(routes[0], swapParams);

      // Dispatch event to refresh header balance after successful deposit
      window.dispatchEvent(new CustomEvent("tokenMinted"));

      setView("success");
    } catch (err) {
      console.error("Swap failed:", err);
      setView("amount");
    }
  }, [
    evmAccount,
    selectedFromToken,
    selectedToToken,
    fromChain,
    toChain,
    tokenAmount,
    embeddedWalletAddress,
    getRoutesForSwap,
    executeSwap,
    clearError,
  ]);

  const handleSetMax = useCallback(() => {
    if (!userBalance) return;
    const isNative =
      selectedFromToken && isNativeToken(selectedFromToken.address);
    const max = isNative
      ? Math.max(0, userBalance.balance - 0.01)
      : userBalance.balance;
    setTokenAmount(max.toString());
  }, [userBalance, selectedFromToken]);

  // Select View
  if (view === "select") {
    return (
      <div className="p-[16px]">
        <div className="mb-[16px]">
          <BodyText className="text-[#dde2f6] mb-[8px]">
            Deposit any token from any chain
          </BodyText>
        </div>

        <div className="space-y-[12px] mb-[16px]">
          <div>
            <label className="block text-sm font-medium text-[#dde2f6] mb-[8px]">
              From Chain
            </label>
            <select
              value={fromChain?.id || ""}
              onChange={(e) => {
                const chain = chains.find(
                  (c) => c.id === Number(e.target.value)
                );
                setFromChain(chain || null);
                setSelectedFromToken(null);
              }}
              className="w-full p-[12px] bg-[#2a2f42] border border-[rgba(221,226,246,0.1)] rounded-[8px] text-[#dde2f6]"
            >
              <option value="">Select chain</option>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#dde2f6] mb-[8px]">
              From Token
            </label>
            {isLoadingBalances ? (
              <div className="w-full p-[12px] bg-[#2a2f42] border border-[rgba(221,226,246,0.1)] rounded-[8px] text-[#dde2f6] text-center">
                Loading tokens...
              </div>
            ) : fromTokens.length === 0 ? (
              <div className="w-full p-[12px] bg-[#2a2f42] border border-[rgba(221,226,246,0.1)] rounded-[8px] text-[#dde2f6] text-center opacity-75">
                No tokens with balance found
              </div>
            ) : (
              <select
                value={selectedFromToken?.address || ""}
                onChange={(e) =>
                  setSelectedFromToken(
                    fromTokens.find((t) => t.address === e.target.value) || null
                  )
                }
                className="w-full p-[12px] bg-[#2a2f42] border border-[rgba(221,226,246,0.1)] rounded-[8px] text-[#dde2f6]"
              >
                <option value="">Select token</option>
                {fromTokens.map((token) => {
                  const bal = isNativeToken(token.address)
                    ? userTokensWithBalance.find((b) =>
                        isNativeToken(b.address)
                      )
                    : userTokensWithBalance.find(
                        (b) =>
                          b.address.toLowerCase() ===
                          token.address.toLowerCase()
                      );
                  return (
                    <option
                      key={token.address || "native"}
                      value={token.address || ""}
                    >
                      {token.symbol}
                      {bal ? ` (${bal.balance.toFixed(4)})` : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div className="p-[12px] bg-[#1a1f2e] rounded-[8px]">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#474d68]">To</span>
              <span className="text-[#dde2f6]">
                {selectedToToken?.symbol || "USDC"} on {toChain.name}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setView("amount");
            clearError();
          }}
          disabled={!selectedFromToken || !selectedToToken}
          className="w-full bg-[#72D0ED] hover:bg-[#5fb8d6] disabled:bg-gray-600 text-[#0e1219] font-semibold py-[12px] rounded-[8px]"
        >
          Continue
        </button>
      </div>
    );
  }

  // Amount View
  if (view === "amount") {
    return (
      <div className="p-[16px]">
        <button
          type="button"
          onClick={() => setView("select")}
          className="flex items-center gap-[8px] text-[#474d68] hover:text-[#dde2f6] mb-[16px]"
        >
          <svg
            className="w-[16px] h-[16px]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="text-sm">Back</span>
        </button>

        <div className="mb-[16px]">
          <BodyText className="text-[#dde2f6]">Enter amount</BodyText>
          <p className="text-xs text-[#474d68]">
            {selectedFromToken?.symbol} → {selectedToToken?.symbol}
          </p>
        </div>

        <div className="mb-[16px]">
          <div className="relative">
            <input
              type="number"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              placeholder="0.00"
              className="w-full p-[12px] pr-[60px] bg-[#2a2f42] border border-[rgba(221,226,246,0.1)] rounded-[8px] text-[#dde2f6]"
            />
            <button
              type="button"
              onClick={handleSetMax}
              className="absolute right-[8px] top-1/2 -translate-y-1/2 px-[8px] py-[4px] text-xs text-[#72D0ED]"
            >
              MAX
            </button>
          </div>
          {userBalance && (
            <div className="mt-[8px] text-sm text-[#474d68]">
              Available: {userBalance.balance.toFixed(4)}{" "}
              {selectedFromToken?.symbol}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleExecute}
          disabled={!tokenAmount || parseFloat(tokenAmount) <= 0 || isLoading}
          className="w-full bg-[#72D0ED] hover:bg-[#5fb8d6] disabled:bg-gray-600 text-[#0e1219] font-semibold py-[12px] rounded-[8px]"
        >
          {isLoading ? "Processing..." : "Deposit"}
        </button>

        {error && (
          <div className="mt-[12px] p-[12px] bg-red-500/10 border border-red-500/20 rounded-[8px] text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Executing View
  if (view === "executing") {
    return (
      <div className="p-[16px] text-center">
        <div className="w-[48px] h-[48px] border-4 border-[#72D0ED] border-t-transparent rounded-full animate-spin mx-auto mb-[16px]" />
        <BodyText className="text-[#dde2f6]">
          Processing transaction...
        </BodyText>
        <p className="text-sm text-[#474d68] mt-[8px]">
          Please confirm in your wallet
        </p>
      </div>
    );
  }

  // Success View
  if (view === "success") {
    return (
      <div className="p-[16px] text-center">
        <div className="w-[64px] h-[64px] bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-[16px]">
          <svg
            className="w-[32px] h-[32px] text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <BodyText className="text-[#dde2f6] mb-[16px]">
          Transaction Successful!
        </BodyText>
        <button
          type="button"
          onClick={onBack}
          className="w-full bg-[#72D0ED] hover:bg-[#5fb8d6] text-[#0e1219] font-semibold py-[12px] rounded-[8px]"
        >
          Done
        </button>
      </div>
    );
  }

  return null;
}
