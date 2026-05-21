"use client";

import { useWallet } from "@/lib/providers";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useLiFi } from "@/lib/hooks/useLiFi";
import { loadLiFiTokens } from "@/lib/lifi";
import type { Token } from "@lifi/sdk";
import { WSOL_MINT } from "@/lib/constants";

interface LiFiViewProps {
  embeddedWalletAddress: string;
  onBack: () => void;
}

type View = "select" | "amount" | "executing" | "success";

// Solana mainnet chain ID in LiFi
const SOLANA_CHAIN_ID = 1151111081099710;
// Native SOL system program address used by LiFi
const NATIVE_SOL_ADDRESS = "11111111111111111111111111111111";

const isSolNativeToken = (address?: string): boolean => {
  if (!address) return true;
  return (
    address === NATIVE_SOL_ADDRESS ||
    address.toLowerCase() === WSOL_MINT.toLowerCase()
  );
};

export function LiFiView({ embeddedWalletAddress, onBack }: LiFiViewProps) {
  const { solanaAccount } = useWallet();
  const [view, setView] = useState<View>("select");
  const [solanaTokens, setSolanaTokens] = useState<Token[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [selectedFromToken, setSelectedFromToken] = useState<Token | null>(null);
  const [selectedToToken, setSelectedToToken] = useState<Token | null>(null);
  const [tokenAmount, setTokenAmount] = useState("");

  // Without React SDK's useTokenBalances, disable balance pre-filtering.
  const tokenBalances: { address?: string; balance: number }[] = [];
  const isLoadingBalances = false;

  const { getRoutesForSwap, executeSwap, isLoading, error, clearError } =
    useLiFi();

  // Load all Solana tokens from LiFi
  useEffect(() => {
    setIsLoadingTokens(true);
    loadLiFiTokens(SOLANA_CHAIN_ID).then((tokens) => {
      setSolanaTokens(tokens);
      setIsLoadingTokens(false);
      // Default to native SOL as destination (trading uses wSOL, auto-wrapped from SOL)
      const nativeSol = tokens.find((t) => t.address === NATIVE_SOL_ADDRESS);
      if (nativeSol) setSelectedToToken(nativeSol);
      // Default to native SOL as source too (user can change)
      const sol = tokens.find((t) => isSolNativeToken(t.address));
      if (sol && !selectedFromToken) setSelectedFromToken(sol);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tokens the user actually has balance for
  const userTokensWithBalance = useMemo(() => {
    if (!tokenBalances) return [];
    return tokenBalances.filter(
      (b): b is { address: string; balance: number } => b.balance > 0 && b.address !== undefined
    );
  }, [tokenBalances]);

  // Filter LiFi token list to only tokens the user holds
  const fromTokens = useMemo(() => {
    return solanaTokens.filter((token) => {
      if (isSolNativeToken(token.address)) {
        return userTokensWithBalance.some((b) => isSolNativeToken(b.address));
      }
      return userTokensWithBalance.some(
        (b) => b.address.toLowerCase() === token.address.toLowerCase()
      );
    });
  }, [solanaTokens, userTokensWithBalance]);

  const userBalance = useMemo(() => {
    if (!selectedFromToken) return null;
    if (isSolNativeToken(selectedFromToken.address)) {
      return userTokensWithBalance.find((b) => isSolNativeToken(b.address));
    }
    return userTokensWithBalance.find(
      (b) => b.address.toLowerCase() === selectedFromToken.address.toLowerCase()
    );
  }, [selectedFromToken, userTokensWithBalance]);

  // True when FROM and TO are both native SOL (no swap needed)
  const isSameToken = useMemo(() => {
    if (!selectedFromToken || !selectedToToken) return false;
    return isSolNativeToken(selectedFromToken.address) && isSolNativeToken(selectedToToken.address);
  }, [selectedFromToken, selectedToToken]);

  const handleExecute = useCallback(async () => {
    if (
      !solanaAccount?.address ||
      !selectedFromToken ||
      !selectedToToken ||
      !tokenAmount
    )
      return;

    try {
      clearError();
      setView("executing");

      const routes = await getRoutesForSwap({
        fromChainId: SOLANA_CHAIN_ID,
        toChainId: SOLANA_CHAIN_ID,
        fromTokenAddress: selectedFromToken.address,
        fromTokenDecimals: selectedFromToken.decimals,
        toTokenAddress: selectedToToken.address,
        fromAmount: tokenAmount,
        fromAddress: solanaAccount.address,
        toAddress: embeddedWalletAddress,
      });

      if (routes.length === 0) throw new Error("No routes found");

      await executeSwap(routes[0]);

      window.dispatchEvent(new CustomEvent("depositComplete"));
      setView("success");
    } catch (err) {
      console.error("Swap failed:", err);
      setView("amount");
    }
  }, [
    solanaAccount,
    selectedFromToken,
    selectedToToken,
    tokenAmount,
    embeddedWalletAddress,
    getRoutesForSwap,
    executeSwap,
    clearError,
  ]);

  const handleSetMax = useCallback(() => {
    if (!userBalance) return;
    const isNative = selectedFromToken && isSolNativeToken(selectedFromToken.address);
    // Reserve small amount for transaction fees on Solana
    const max = isNative
      ? Math.max(0, userBalance.balance - 0.005)
      : userBalance.balance;
    setTokenAmount(max.toString());
  }, [userBalance, selectedFromToken]);

  // No Solana wallet connected
  if (!solanaAccount) {
    return (
      <div className="p-[16px] text-center">
        <p className="font-medium text-[16px] text-[#030303] mb-[8px]">
          Connect a Solana Wallet
        </p>
        <p className="text-sm text-[#606060]">
          Connect your Solana wallet to swap tokens.
        </p>
      </div>
    );
  }

  // Select View
  if (view === "select") {
    const isLoading = isLoadingBalances || isLoadingTokens;

    return (
      <div className="p-[16px]">
        <div className="mb-[16px]">
          <p className="font-['Clash_Display',sans-serif] text-[16px] text-white mb-[4px]">
            Swap tokens to SOL
          </p>
          <p className="text-xs font-['Clash_Display',sans-serif] text-[rgba(139,92,246,0.6)]">
            SOL is used for trading on Kalshi
          </p>
        </div>

        <div className="space-y-[12px] mb-[16px]">
          <div>
            <label className="block text-sm font-medium font-['Clash_Display',sans-serif] text-white mb-[8px]">
              From Token
            </label>
            {isLoading ? (
              <div className="w-full p-[12px] bg-[#1a1b23] border border-[#262a34] rounded-[8px] text-white text-center font-['Clash_Display',sans-serif] flex items-center justify-center gap-[8px]">
                <div className="w-[14px] h-[14px] border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
                <span className="opacity-75">Loading tokens...</span>
              </div>
            ) : fromTokens.length === 0 ? (
              <div className="w-full p-[12px] bg-[#1a1b23] border border-[#262a34] rounded-[8px] text-center font-['Clash_Display',sans-serif] space-y-[4px]">
                <p className="text-white opacity-75">No tokens with balance found</p>
                <p className="text-xs text-[rgba(139,92,246,0.6)]">
                  Fund your wallet first, or use the QR code to receive SOL
                </p>
              </div>
            ) : (
              <select
                value={selectedFromToken?.address || ""}
                onChange={(e) =>
                  setSelectedFromToken(
                    fromTokens.find((t) => t.address === e.target.value) || null
                  )
                }
                className="w-full p-[12px] bg-[#1a1b23] border border-[#262a34] rounded-[8px] text-white font-['Clash_Display',sans-serif]"
              >
                <option value="">Select token</option>
                {fromTokens.map((token) => {
                  const bal = isSolNativeToken(token.address)
                    ? userTokensWithBalance.find((b) => isSolNativeToken(b.address))
                    : userTokensWithBalance.find(
                        (b) =>
                          b.address.toLowerCase() === token.address.toLowerCase()
                      );
                  return (
                    <option key={token.address || "native"} value={token.address || ""}>
                      {token.symbol}
                      {bal ? ` (${bal.balance.toFixed(4)})` : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div className="p-[12px] bg-[#0e1015] rounded-[8px] border border-[#262a34]">
            <div className="flex justify-between items-center text-sm">
              <span className="font-['Clash_Display',sans-serif] text-[rgba(139,92,246,0.6)]">
                To
              </span>
              <span className="font-['Clash_Display',sans-serif] text-white">
                SOL on Solana
              </span>
            </div>
          </div>

          {isSameToken && (
            <div className="p-[10px] bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.2)] rounded-[8px]">
              <p className="text-xs font-['Clash_Display',sans-serif] text-[rgba(139,92,246,0.8)] text-center">
                You already have SOL — use the QR code to deposit it directly
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setView("amount");
            clearError();
          }}
          disabled={!selectedFromToken || !selectedToToken || isSameToken || isLoading}
          className="w-full bg-linear-to-r from-[#8b5cf6] to-[#06b6d4] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-['Clash_Display',sans-serif] font-semibold py-[12px] rounded-[8px]"
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
          className="flex items-center gap-[8px] text-[rgba(139,92,246,0.6)] hover:text-[#8b5cf6] mb-[16px]"
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
          <span className="text-sm font-['Clash_Display',sans-serif]">Back</span>
        </button>

        <div className="mb-[16px]">
          <p className="font-['Clash_Display',sans-serif] text-[16px] text-white">
            Enter amount
          </p>
          <p className="text-xs font-['Clash_Display',sans-serif] text-[rgba(139,92,246,0.6)]">
            {selectedFromToken?.symbol} → SOL
          </p>
        </div>

        <div className="mb-[16px]">
          <div className="relative">
            <input
              type="number"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              placeholder="0.00"
              className="w-full p-[12px] pr-[60px] bg-[#1a1b23] border border-[#262a34] rounded-[8px] text-white font-['Clash_Display',sans-serif]"
            />
            <button
              type="button"
              onClick={handleSetMax}
              className="absolute right-[8px] top-1/2 -translate-y-1/2 px-[8px] py-[4px] text-xs text-[#8b5cf6] font-['Clash_Display',sans-serif]"
            >
              MAX
            </button>
          </div>
          {userBalance && (
            <div className="mt-[8px] text-sm font-['Clash_Display',sans-serif] text-[rgba(139,92,246,0.6)]">
              Available: {userBalance.balance.toFixed(4)} {selectedFromToken?.symbol}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleExecute}
          disabled={!tokenAmount || parseFloat(tokenAmount) <= 0 || isLoading}
          className="w-full bg-linear-to-r from-[#8b5cf6] to-[#06b6d4] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-['Clash_Display',sans-serif] font-semibold py-[12px] rounded-[8px]"
        >
          {isLoading ? "Processing..." : "Swap to SOL"}
        </button>

        {error && (
          <div className="mt-[12px] p-[12px] bg-red-500/10 border border-red-500/20 rounded-[8px] text-red-400 text-sm font-['Clash_Display',sans-serif]">
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
        <div className="w-[48px] h-[48px] border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin mx-auto mb-[16px]" />
        <p className="font-['Clash_Display',sans-serif] text-[16px] text-white">
          Processing transaction...
        </p>
        <p className="text-sm font-['Clash_Display',sans-serif] text-[rgba(139,92,246,0.6)] mt-[8px]">
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
        <p className="font-['Clash_Display',sans-serif] text-[16px] text-white mb-[4px]">
          Swap Successful!
        </p>
        <p className="text-sm font-['Clash_Display',sans-serif] text-[rgba(139,92,246,0.6)] mb-[16px]">
          SOL has been deposited to your wallet
        </p>
        <button
          type="button"
          onClick={onBack}
          className="w-full bg-linear-to-r from-[#8b5cf6] to-[#06b6d4] hover:opacity-90 text-white font-['Clash_Display',sans-serif] font-semibold py-[12px] rounded-[8px]"
        >
          Done
        </button>
      </div>
    );
  }

  return null;
}
