"use client";

/**
 * Cash Pickup Widget
 *
 * Full-screen iframe that handles the entire off-ramp flow internally.
 * Handles the postMessage protocol on your app's side:
 *
 *   RAMPS_READY → RAMPS_CONFIG
 *   RAMPS_CHECK_BALANCE → RAMPS_BALANCE_RESULT  (fetches on-chain USDC balance)
 *   RAMPS_SIGN_TRANSACTION → RAMPS_SIGN_SUCCESS | RAMPS_SIGN_ERROR  (signs + broadcasts)
 *   RAMPS_TRANSACTION_COMPLETE → onSuccess + onClose
 *   RAMPS_CLOSE → onClose
 *   RAMPS_OPEN_URL → window.open
 *
 * Supports Base, Ethereum, and Solana. The active chain is sent in RAMPS_CONFIG;
 * payload.chain in each incoming message is used for balance/signing dispatch.
 */

import { useEffect, useRef } from "react";
import type { WalletAccount } from "@dynamic-labs-sdk/client";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { isSolanaWalletAccount } from "@dynamic-labs-sdk/solana";
import { CHAINS, type MgChain } from "@/lib/chains";
import { fetchUsdcBalance } from "@/lib/balance";
import { sendUsdc } from "@/lib/send-usdc";
import { env } from "@/lib/env";

const WIDGET_ORIGIN = "https://d3em1tdv304u3f.cloudfront.net";
const API_BASE_URL = "https://zq4rdvdd9j.execute-api.us-east-2.amazonaws.com";

interface CashPickupWidgetProps {
  open: boolean;
  selectedChain: MgChain;
  walletAccounts: WalletAccount[];
  onClose: () => void;
  onSuccess?: (amount: number) => void;
}

function getAddressForChain(chain: MgChain, accounts: WalletAccount[]): string {
  if (chain === "solana") return accounts.find(isSolanaWalletAccount)?.address ?? "";
  return accounts.find(isEvmWalletAccount)?.address ?? "";
}

export function CashPickupWidget({
  open,
  selectedChain,
  walletAccounts,
  onClose,
  onSuccess,
}: CashPickupWidgetProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const selectedChainRef = useRef(selectedChain);
  const walletAccountsRef = useRef(walletAccounts);
  const onCloseRef = useRef(onClose);
  const onSuccessRef = useRef(onSuccess);
  const pendingAmountRef = useRef(0);

  useEffect(() => { selectedChainRef.current = selectedChain; }, [selectedChain]);
  useEffect(() => { walletAccountsRef.current = walletAccounts; }, [walletAccounts]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);

  useEffect(() => {
    if (!open) return;

    function post(type: string, payload?: unknown) {
      iframeRef.current?.contentWindow?.postMessage(
        payload ? { type, payload } : { type },
        WIDGET_ORIGIN,
      );
    }

    async function handleMessage(event: MessageEvent) {
      if (event.origin !== WIDGET_ORIGIN) return;

      const { type, payload } = (event.data ?? {}) as {
        type: string;
        payload: Record<string, unknown>;
      };

      switch (type) {
        case "RAMPS_READY": {
          const chain = selectedChainRef.current;
          const address = getAddressForChain(chain, walletAccountsRef.current);
          post("RAMPS_CONFIG", {
            apiKey: env.NEXT_PUBLIC_MG_RAMP_KEY,
            wallet: {
              address,
              chain,
              asset: "USDC",
              walletType: "non-custodial",
            },
            devConfig: {
              mockMode: false,
              apiBaseUrl: API_BASE_URL,
              apiVersion: "v2",
            },
            theme: "dark",
          });
          break;
        }

        case "RAMPS_CHECK_BALANCE": {
          const chain = (payload?.chain as MgChain) ?? selectedChainRef.current;
          const address = getAddressForChain(chain, walletAccountsRef.current);
          const requestedAmount = (payload?.amount as number) ?? 0;
          const balance = await fetchUsdcBalance(chain, address);
          post("RAMPS_BALANCE_RESULT", {
            walletAddress: address,
            balance,
            asset: "USDC",
            sufficient: balance >= requestedAmount,
          });
          break;
        }

        case "RAMPS_SIGN_TRANSACTION": {
          const chain = (payload?.chain as MgChain) ?? selectedChainRef.current;
          const to = (payload?.to as string) ?? "";
          const amount = parseFloat((payload?.amount as string) ?? "0");
          try {
            const hash = await sendUsdc({
              to,
              amount: String(amount),
              chain,
              walletAccounts: walletAccountsRef.current,
            });
            pendingAmountRef.current = amount;
            post("RAMPS_SIGN_SUCCESS", { txHash: hash });
          } catch (err) {
            post("RAMPS_SIGN_ERROR", {
              error: err instanceof Error ? err.message : "Transaction failed",
            });
          }
          break;
        }

        case "RAMPS_TRANSACTION_COMPLETE":
          onSuccessRef.current?.(pendingAmountRef.current);
          onCloseRef.current();
          break;

        case "RAMPS_OPEN_URL":
          if (payload?.url && typeof payload.url === "string") {
            window.open(payload.url, "_blank", "noopener,noreferrer");
          }
          break;

        case "RAMPS_CLOSE":
          onCloseRef.current();
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open]);

  if (!open) return null;

  const src = `${WIDGET_ORIGIN}/stub-widget.html?mode=off-ramp&key=${env.NEXT_PUBLIC_MG_RAMP_KEY}&theme=dark`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-[600px] rounded-2xl overflow-hidden shadow-2xl">
        <iframe
          ref={iframeRef}
          src={src}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="clipboard-write; camera"
          title="Cash Pickup"
        />
      </div>
    </div>
  );
}
