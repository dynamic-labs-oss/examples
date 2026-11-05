"use client";

import { useCallback, useState } from "react";
import { createPublicClient, http } from "viem";
import {
  getActiveNetworkId,
  switchActiveNetwork,
} from "@dynamic-labs-sdk/client";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { dynamicClient } from "./dynamic";
import { useWallet } from "./providers";
import { getNetworkConfigOrDefault } from "./networks";

type ActionStep = {
  name: string;
  tx: { to: string; chainId: number; data?: string; value?: string };
};

export type TxRecord = { hash: string; name: string };

export type ExecuteState = {
  running: boolean;
  step: { current: number; total: number } | null;
  hashes: TxRecord[];
  error: string | null;
};

const initial: ExecuteState = {
  running: false,
  step: null,
  hashes: [],
  error: null,
};

/**
 * Executes an ordered list of vaults.fyi action steps with the connected
 * Dynamic-backed viem WalletClient, waiting for each receipt before
 * proceeding to the next.
 *
 * vaults.fyi returns `actions[]` with raw `tx.to`, `tx.data`, `tx.value`,
 * `tx.chainId` per step. Each step is signed via a fresh WalletClient
 * built by `createWalletClientForWalletAccount({ walletAccount })` from
 * `@dynamic-labs-sdk/evm/viem` — the SDK derives `chain` from the wallet
 * account's active network, so we call `switchActiveNetwork` first when
 * a step's `tx.chainId` doesn't match the active chain. This is the
 * verified signature in node_modules/@dynamic-labs-sdk/evm — the morpho
 * example passes a stray `chain` prop that the SDK type doesn't accept;
 * we use the documented path instead.
 *
 * Multi-chain: actions across different chains are handled in-loop. If
 * vaults.fyi returns interleaved cross-chain steps the user will see
 * multiple network-switch prompts — vault deposits/redeems are normally
 * single-chain so this is a rare path.
 */
export function useExecuteAction() {
  const { evmAccount } = useWallet();
  const [state, setState] = useState<ExecuteState>(initial);

  const execute = useCallback(
    async (currentActionIndex: number, actions: ActionStep[]) => {
      if (!evmAccount) {
        setState({
          ...initial,
          error: "Wallet not ready. Sign in with Dynamic first.",
        });
        return;
      }

      const remaining = actions.slice(currentActionIndex);
      if (remaining.length === 0) {
        setState({ ...initial, error: "Nothing to execute." });
        return;
      }

      setState({ running: true, step: null, hashes: [], error: null });
      const hashes: TxRecord[] = [];

      try {
        for (let i = 0; i < remaining.length; i++) {
          const step = remaining[i];
          setState((s) => ({
            ...s,
            step: { current: i + 1, total: remaining.length },
          }));

          const network = getNetworkConfigOrDefault(step.tx.chainId);

          // Ensure active Dynamic network matches the action's chainId.
          const { networkId: activeId } = await getActiveNetworkId(
            { walletAccount: evmAccount },
            dynamicClient,
          );
          if (Number(activeId) !== network.chainId) {
            await switchActiveNetwork(
              {
                networkId: String(network.chainId),
                walletAccount: evmAccount,
              },
              dynamicClient,
            );
          }

          const walletClient = await createWalletClientForWalletAccount({
            walletAccount: evmAccount,
          });
          const publicClient = createPublicClient({
            chain: network.chain,
            transport: http(),
          });

          const hash = await walletClient.sendTransaction({
            to: step.tx.to as `0x${string}`,
            data: step.tx.data as `0x${string}` | undefined,
            value: step.tx.value ? BigInt(step.tx.value) : undefined,
          });
          await publicClient.waitForTransactionReceipt({
            hash,
            confirmations: 2,
          });
          hashes.push({ hash, name: step.name });
        }
        setState({ running: false, step: null, hashes, error: null });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        setState({ running: false, step: null, hashes, error: message });
      }
    },
    [evmAccount],
  );

  const reset = useCallback(() => setState(initial), []);

  return { ...state, execute, reset };
}
