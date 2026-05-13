"use client";

import { DynamicConnectButton } from "@dynamic-labs/sdk-react-core";

interface ActionButtonsProps {
  isLoading: boolean;
  isExecuting: boolean;
  hasQuote: boolean;
  isConnected: boolean;
  onGetQuote: () => void;
  onExecuteSwap: () => void;
}

export default function ActionButtons({
  isLoading,
  isExecuting,
  hasQuote,
  isConnected,
  onGetQuote,
  onExecuteSwap,
}: ActionButtonsProps) {
  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex justify-center">
          <DynamicConnectButton buttonClassName="px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700">
            Connect Wallet to Get Started
          </DynamicConnectButton>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={onGetQuote}
          disabled={isLoading}
          className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg ${
            isLoading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
          }`}
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Getting Quote...</span>
            </div>
          ) : (
            "Get Quote"
          )}
        </button>

        {hasQuote && !isExecuting && (
          <button
            onClick={onExecuteSwap}
            disabled={isLoading}
            className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg ${
              isLoading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700"
            }`}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Executing...</span>
              </div>
            ) : (
              "Execute Swap"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
