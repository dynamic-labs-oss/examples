"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Chain = "evm" | "solana";

const STORAGE_KEY = "subscriptions:chain";

const ChainContext = createContext<{ chain: Chain; setChain: (c: Chain) => void }>({
  chain: "evm",
  setChain: () => {},
});

// Which chain's subscribe / subscriptions UI is showing. Remembered per
// browser (a convenience only; the app works fine if storage is unavailable).
export function ChainProvider({ children }: { children: ReactNode }) {
  const [chain, setChainState] = useState<Chain>("evm");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "evm" || saved === "solana") setChainState(saved);
    } catch {}
  }, []);

  const setChain = useCallback((c: Chain) => {
    setChainState(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, c);
    } catch {}
  }, []);

  return <ChainContext.Provider value={{ chain, setChain }}>{children}</ChainContext.Provider>;
}

export const useChain = () => useContext(ChainContext);
