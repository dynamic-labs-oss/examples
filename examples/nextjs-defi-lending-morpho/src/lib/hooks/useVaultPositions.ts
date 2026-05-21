import { useState, useEffect } from "react";
import { formatUnits } from "viem";
import { Vault } from "./useVaultsList";
import { useWallet } from "@/lib/providers";
import { getApiForChain } from "../constants";

export interface VaultPosition {
  vault: Vault;
  shares: bigint;
  assets: bigint;
  assetsFormatted: string;
}

interface VaultPositionApiItem {
  vault: {
    address: string;
  };
  state: {
    shares: string;
    assets: string;
  } | null;
}

export function useVaultPositions(address: string | undefined, vaults: Vault[], refreshKey = 0) {
  const { chainId } = useWallet();
  const [positions, setPositions] = useState<VaultPosition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setPositions([]);
      return;
    }

    const api = getApiForChain(chainId);
    if (!api?.morphoGraphql) return;

    setLoading(true);

    const query = `
      query GetVaultPositions($chainId: Int!, $userAddress: String!) {
        vaultPositions(
          where: { chainId_in: [$chainId], userAddress_in: [$userAddress] }
        ) {
          items {
            vault { address }
            state { shares assets }
          }
        }
      }
    `;

    fetch(api.morphoGraphql, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { chainId, userAddress: address } }),
    })
      .then((r) => r.json())
      .then((json) => {
        const items: VaultPositionApiItem[] = json?.data?.vaultPositions?.items ?? [];
        const vaultMap = new Map(vaults.map((v) => [v.address.toLowerCase(), v]));

        const newPositions: VaultPosition[] = items
          .filter((item) => item.state && BigInt(item.state.shares ?? "0") > 0n)
          .map((item) => {
            const vault = vaultMap.get(item.vault.address.toLowerCase());
            if (!vault) return null;
            const shares = BigInt(item.state!.shares);
            const assets = BigInt(item.state!.assets ?? "0");
            return {
              vault,
              shares,
              assets,
              assetsFormatted: formatUnits(assets, vault.assetDecimals),
            };
          })
          .filter((p): p is VaultPosition => p !== null);

        setPositions(newPositions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address, chainId, refreshKey, vaults.length]);

  return { positions, loading };
}
