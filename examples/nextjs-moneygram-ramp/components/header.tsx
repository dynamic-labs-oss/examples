"use client";

import { useEffect, useState } from "react";
import { isSignedIn, logout, onEvent } from "@dynamic-labs-sdk/client";
import { initDynamic, dynamicClient } from "@/lib/dynamic";
import { LogOut } from "lucide-react";

export function Header() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    initDynamic().then(() => {
      setSignedIn(isSignedIn());
      unsub = onEvent(
        { event: "tokenChanged", listener: ({ token }) => setSignedIn(!!token) },
        dynamicClient,
      );
    });
    return () => unsub?.();
  }, []);

  return (
    <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-white font-semibold text-base tracking-tight">Cash Pickup</span>
          </div>
          {signedIn && (
            <button
              onClick={() => logout(dynamicClient)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
