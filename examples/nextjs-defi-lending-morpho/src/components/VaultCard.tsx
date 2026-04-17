"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { DynamicConnectButton } from "@dynamic-labs/sdk-react-core";
import { useVaultOperations } from "@/lib/hooks/useVaultOperations";
import { Vault } from "@/lib/hooks/useVaultsList";

interface VaultCardProps {
  vault: Vault;
}

export function VaultCard({ vault }: VaultCardProps) {
  const { address, isConnected } = useAccount();
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  const vaultInfo = {
    address: vault.address,
    asset: {
      address: vault.assetAddress,
      symbol: vault.asset,
      decimals: vault.assetDecimals,
    },
  };

  const {
    amount,
    setAmount,
    txStatus,
    pendingDeposit,
    assetBalance,
    depositedAssets,
    handleApprove,
    handleDeposit,
    handleWithdraw,
    isApproving,
    isDepositing,
    isWithdrawing,
    needsApproval,
  } = useVaultOperations(address, vaultInfo);

  const isLoading = isApproving || isDepositing || isWithdrawing;

  const maxAmount = mode === "deposit"
    ? assetBalance ? formatUnits(assetBalance as bigint, vault.assetDecimals) : "0"
    : depositedAssets ? formatUnits(depositedAssets as bigint, vault.assetDecimals) : "0";

  const depositedDisplay = depositedAssets
    ? formatUnits(depositedAssets as bigint, vault.assetDecimals)
    : "0";

  const exceedsBalance =
    isConnected && amount !== "" && parseFloat(amount) > parseFloat(maxAmount);

  return (
    <div className="bg-white rounded-xl border border-earn-border shadow-sm flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-earn-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-earn-text-primary truncate">{vault.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {vault.whitelisted && (
                <span className="bg-green-100 text-green-700 text-xs font-medium px-1.5 py-0.5 rounded">
                  Whitelisted
                </span>
              )}
              <span className="text-earn-text-secondary text-xs">{vault.asset}</span>
            </div>
          </div>
          <div
            className="shrink-0 px-2 py-1 rounded-md text-sm font-semibold"
            style={{ background: "#E8F0FE", color: "#1967D2" }}
          >
            {vault.netApy} APY
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div>
            <p className="text-[10px] font-medium text-earn-text-secondary uppercase tracking-wide">TVL</p>
            <p className="text-sm font-semibold text-earn-text-primary mt-0.5">{vault.tvl}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-earn-text-secondary uppercase tracking-wide">Share Price</p>
            <p className="text-sm font-semibold text-earn-text-primary mt-0.5">{vault.sharePrice}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-earn-text-secondary uppercase tracking-wide">Supply</p>
            <p className="text-sm font-semibold text-earn-text-primary mt-0.5 truncate">{vault.totalSupply}</p>
          </div>
        </div>

        {vault.rewards.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {vault.rewards.map((reward, i) => (
              <span
                key={i}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: "#E8F0FE", color: "#1967D2" }}
              >
                {reward.asset} {reward.supplyApr}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Position banner */}
      {isConnected && parseFloat(depositedDisplay) > 0 && (
        <div
          className="px-4 py-2 text-xs border-b border-earn-border"
          style={{ background: "#E8F0FE" }}
        >
          <span className="font-medium" style={{ color: "#1967D2" }}>Your position: </span>
          <span style={{ color: "#1967D2" }}>{parseFloat(depositedDisplay).toFixed(6)} {vault.asset}</span>
        </div>
      )}

      {/* Deposit / Withdraw */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Tab selector */}
        <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: "#F0F0F0" }}>
          {(["deposit", "withdraw"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMode(tab)}
              className="flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all"
              style={
                mode === tab
                  ? { background: "#fff", color: "#030303", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                  : { color: "#606060" }
              }
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Status message */}
        {txStatus && (
          <div
            className={`p-2 rounded-lg text-xs ${
              txStatus.includes("sent!") || txStatus.includes("success")
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-600"
            }`}
          >
            {txStatus}
          </div>
        )}

        {pendingDeposit && txStatus.includes("Approval") && (
          <div className="p-2 rounded-lg text-xs border" style={{ background: "#E8F0FE", borderColor: "#4779FF33", color: "#1967D2" }}>
            Approval successful! Preparing deposit...
          </div>
        )}

        {/* Amount input */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs text-earn-text-secondary font-medium">
              Amount ({vault.asset})
            </label>
            <button
              type="button"
              onClick={() => setAmount(maxAmount)}
              className="text-xs hover:underline"
              style={{ color: "#4779FF" }}
              disabled={isLoading}
            >
              Max: {parseFloat(maxAmount).toFixed(4)}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.000001"
              min="0"
              disabled={isLoading}
              className="flex-1 text-xs px-3 py-2 rounded-lg text-earn-text-primary outline-none focus:ring-1 focus:ring-earn-primary/30"
              style={{ border: `1px solid ${exceedsBalance ? "#EF4444" : "#DADADA"}`, background: "#fff" }}
            />
            {!isConnected ? (
              <DynamicConnectButton buttonClassName="px-3 py-2 text-xs font-medium rounded-lg text-white transition-colors whitespace-nowrap cursor-pointer bg-earn-primary">
                Connect
              </DynamicConnectButton>
            ) : needsApproval && mode === "deposit" ? (
              <button
                onClick={handleApprove}
                disabled={isLoading || !amount || parseFloat(amount) <= 0 || exceedsBalance}
                className="px-3 py-2 text-xs font-medium rounded-lg text-white transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#EAB308" }}
              >
                {isApproving ? "…" : "Approve"}
              </button>
            ) : (
              <button
                onClick={(e) => { e.preventDefault(); mode === "deposit" ? handleDeposit(e) : handleWithdraw(e); }}
                disabled={isLoading || !amount || parseFloat(amount) <= 0 || exceedsBalance}
                className="px-3 py-2 text-xs font-medium rounded-lg text-white transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: mode === "deposit" ? "#4779FF" : "#606060" }}
              >
                {isLoading ? "…" : mode === "deposit" ? "Deposit" : "Withdraw"}
              </button>
            )}
          </div>
          {exceedsBalance && (
            <p className="text-xs text-red-500">Insufficient balance</p>
          )}
        </div>
      </div>
    </div>
  );
}
