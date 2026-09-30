"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { sdk } from "@/lib/vaultsFyi";
import type { VaultOption } from "@/lib/useDiscover";
import { useExecuteAction } from "@/lib/useExecuteAction";
import { DEFAULT_DEPOSIT_AMOUNT } from "@/lib/constants";
import { getNetworkConfigOrDefault } from "@/lib/networks";
import { useTokenBalance } from "@/lib/useTokenBalance";
import { formatApy } from "@/lib/utils";
import { Card } from "./ui/card";

const USDC_DECIMALS = 6;

function explorerTxUrl(chainId: number, hash: string): string {
  switch (chainId) {
    case 1:
      return `https://etherscan.io/tx/${hash}`;
    case 10:
      return `https://optimistic.etherscan.io/tx/${hash}`;
    case 137:
      return `https://polygonscan.com/tx/${hash}`;
    case 8453:
      return `https://basescan.org/tx/${hash}`;
    case 42161:
      return `https://arbiscan.io/tx/${hash}`;
    default:
      return `https://etherscan.io/tx/${hash}`;
  }
}

export function ActionPanel({
  userAddress,
  selected,
}: {
  userAddress: string;
  selected: VaultOption;
}) {
  const queryClient = useQueryClient();
  const { running, step, hashes, error, execute, reset } = useExecuteAction();
  const [amount, setAmount] = useState(DEFAULT_DEPOSIT_AMOUNT);
  const [preparing, setPreparing] = useState(false);

  const network = getNetworkConfigOrDefault(selected.network.chainId);
  const { data: balance } = useTokenBalance(
    userAddress,
    selected.asset.address,
    selected.network.chainId,
    USDC_DECIMALS,
  );

  async function handleDeposit() {
    setPreparing(true);
    reset();
    try {
      const { currentActionIndex, actions } = await sdk.getActions({
        path: {
          action: "deposit",
          userAddress,
          network: selected.network.name,
          vaultId: selected.vaultId,
        },
        query: {
          assetAddress: selected.asset.address,
          amount: parseUnits(
            amount.replace(",", "."),
            USDC_DECIMALS,
          ).toString(),
        },
      });
      await execute(currentActionIndex, actions);
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
    } finally {
      setPreparing(false);
    }
  }

  return (
    <Card
      title={`Deposit into ${selected.name}`}
      subtitle={`${selected.protocol.name} · ${formatApy(
        selected.apy["7day"].total,
      )} 7d APY · ${network.displayName} · ${selected.address}`}
    >
      {balance && (
        <div className="flex items-center justify-between text-xs text-[#606060] mb-1">
          <span>
            Balance: {parseFloat(balance.formatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
          </span>
          <button
            type="button"
            onClick={() => setAmount(balance.formatted)}
            className="text-[#4779FF] hover:underline font-medium"
          >
            Max
          </button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white text-sm border border-[#DADADA] rounded pl-3 pr-16 py-2"
            placeholder="Amount in USDC"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#606060]">
            USDC
          </span>
        </div>
        <button
          onClick={handleDeposit}
          disabled={preparing || running}
          className="bg-[#4779FF] text-white font-medium px-4 py-2 rounded hover:bg-[#3a66e0] disabled:opacity-50"
        >
          {preparing || running
            ? `Depositing…${step ? ` (${step.current}/${step.total})` : ""}`
            : "Deposit"}
        </button>
      </div>
      {hashes.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs">
          {hashes.map((h) => (
            <li key={h.hash}>
              <a
                href={explorerTxUrl(selected.network.chainId, h.hash)}
                target="_blank"
                rel="noreferrer"
                className="text-[#4779FF] hover:underline"
              >
                {h.hash}
              </a>{" "}
              <span className="text-[#606060]">({h.name})</span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
